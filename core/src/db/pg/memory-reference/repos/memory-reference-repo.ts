import { and, eq, ne, sql as drizzleSql } from "drizzle-orm";
import {
  memoryReferences,
  messages,
  semanticMemory,
  conversations,
} from "@freeanima/core/db/schema";
import { formatCstIso } from "@freeanima/core/util";
import type { RecordMessageReferencesInput } from "../types.ts";
import {
  parseMemoryReferenceMarkers,
  memoryReferenceWeight,
} from "@freeanima/core/repos/memory-reference/markers";

import { getDb } from "../../client.ts";

export async function recordMessageReferences(
  input: RecordMessageReferencesInput,
): Promise<string[]> {
  const semantic_memory_ids = parseMemoryReferenceMarkers(input.content);
  if (!semantic_memory_ids.length) return [];
  if (input.skip_reference_count) return [];

  const created_at = input.created_at ? new Date(input.created_at) : new Date(formatCstIso());
  const db = getDb();
  const recorded: string[] = [];

  for (const semantic_memory_id of semantic_memory_ids) {
    const exists = await db
      .select({ id: semanticMemory.id })
      .from(semanticMemory)
      .where(eq(semanticMemory.id, semantic_memory_id))
      .limit(1);
    if (!exists.length) continue;

    const inserted = await db
      .insert(memoryReferences)
      .values({
        message_id: input.message_id,
        semantic_memory_id,
        conversation_id: input.conversation_id,
        created_at,
      })
      .onConflictDoNothing({
        target: [memoryReferences.message_id, memoryReferences.semantic_memory_id],
      })
      .returning({ id: memoryReferences.id });
    if (!inserted.length) continue;

    recorded.push(semantic_memory_id);

    const prior = await db
      .select({ id: memoryReferences.id })
      .from(memoryReferences)
      .where(
        and(
          eq(memoryReferences.conversation_id, input.conversation_id),
          eq(memoryReferences.semantic_memory_id, semantic_memory_id),
          ne(memoryReferences.message_id, input.message_id),
        ),
      )
      .limit(1);
    if (prior.length) continue;

    const weight = memoryReferenceWeight(created_at);
    await db
      .update(semanticMemory)
      .set({
        reference_count: drizzleSql`${semanticMemory.reference_count} + ${weight}`,
        updated_at: new Date(formatCstIso()),
      })
      .where(eq(semanticMemory.id, semantic_memory_id));
  }

  return recorded;
}

/** Rescan `[[f-xxx]]` in message bodies, rebuild memory_references (full calibration) */
export async function rebuildMemoryReferencesFromMessages(): Promise<number> {
  const db = getDb();
  await db.delete(memoryReferences);

  const rows = await db
    .select({
      id: messages.id,
      conversation_id: messages.conversation_id,
      content: drizzleSql<string>`btrim((${messages.payload})->>'content')`,
      timestamp: drizzleSql<string | null>`(${messages.payload})->>'timestamp'`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
    .where(
      and(
        drizzleSql`(${messages.payload})->>'role' IN ('user', 'assistant')`,
        drizzleSql`length(btrim((${messages.payload})->>'content')) > 0`,
        drizzleSql`COALESCE(${conversations.platform_info}->>'platform', '') <> 'cron'`,
      ),
    );

  let inserted = 0;
  for (const row of rows) {
    const semantic_memory_ids = parseMemoryReferenceMarkers(row.content);
    if (!semantic_memory_ids.length) continue;

    const created_at = row.timestamp ? new Date(row.timestamp) : new Date(formatCstIso());
    for (const semantic_memory_id of semantic_memory_ids) {
      const exists = await db
        .select({ id: semanticMemory.id })
        .from(semanticMemory)
        .where(eq(semanticMemory.id, semantic_memory_id))
        .limit(1);
      if (!exists.length) continue;

      const refs = await db
        .insert(memoryReferences)
        .values({
          message_id: row.id,
          semantic_memory_id,
          conversation_id: row.conversation_id,
          created_at,
        })
        .onConflictDoNothing({
          target: [memoryReferences.message_id, memoryReferences.semantic_memory_id],
        })
        .returning({ id: memoryReferences.id });
      if (refs.length) inserted += 1;
    }
  }

  return inserted;
}

export async function syncAllReferenceCounts(): Promise<{ updated: number; rebuilt: number }> {
  const rebuilt = await rebuildMemoryReferencesFromMessages();
  const db = getDb();
  await db.update(semanticMemory).set({ reference_count: 0 });

  const rows = await db.select({
    semantic_memory_id: drizzleSql<string>`semantic_memory_id`,
    weightedCount: drizzleSql<number>`weighted_count`,
  }).from(drizzleSql`(
      WITH deduped AS (
        SELECT DISTINCT ON (conversation_id, semantic_memory_id)
          conversation_id,
          semantic_memory_id,
          created_at
        FROM memory_references
        ORDER BY conversation_id, semantic_memory_id, created_at DESC
      )
      SELECT
        semantic_memory_id,
        SUM(
          CASE
            WHEN created_at >= NOW() - INTERVAL '30 days' THEN 2.0
            ELSE 1.0
          END
        )::float8 AS weighted_count
      FROM deduped
      GROUP BY semantic_memory_id
    ) AS ref_counts`);

  const now = new Date(formatCstIso());
  for (const row of rows) {
    await db
      .update(semanticMemory)
      .set({ reference_count: row.weightedCount, updated_at: now })
      .where(eq(semanticMemory.id, row.semantic_memory_id));
  }

  return { updated: rows.length, rebuilt };
}

export async function countReferencesBySemanticMemory(semantic_memory_id: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(memoryReferences)
    .where(eq(memoryReferences.semantic_memory_id, semantic_memory_id));
  return Number(rows[0]?.count ?? 0);
}
