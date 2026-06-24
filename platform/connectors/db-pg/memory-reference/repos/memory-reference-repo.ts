import { and, eq, ne, sql as drizzleSql } from "drizzle-orm";
import {
  memoryReferences,
  messages,
  semanticMemory,
  conversations,
} from "@freeanima/core/db/schema";
import { formatCstIso } from "@freeanima/core/util";
import type { RecordMessageReferencesInput } from "@freeanima/core/repos";
import {
  parseMemoryReferenceMarkers,
  memoryReferenceWeight,
} from "@freeanima/core/repos/memory-reference/markers";

import { getDb } from "../../client.ts";

export async function recordMessageReferences(
  input: RecordMessageReferencesInput,
): Promise<string[]> {
  const semanticMemoryIds = parseMemoryReferenceMarkers(input.content);
  if (!semanticMemoryIds.length) return [];
  if (input.skip_reference_count) return [];

  const createdAt = input.created_at ? new Date(input.created_at) : new Date(formatCstIso());
  const db = getDb();
  const recorded: string[] = [];

  for (const semanticMemoryId of semanticMemoryIds) {
    const exists = await db
      .select({ id: semanticMemory.id })
      .from(semanticMemory)
      .where(eq(semanticMemory.id, semanticMemoryId))
      .limit(1);
    if (!exists.length) continue;

    const inserted = await db
      .insert(memoryReferences)
      .values({
        messageId: input.message_id,
        semanticMemoryId,
        conversationId: input.conversation_id,
        createdAt,
      })
      .onConflictDoNothing({
        target: [memoryReferences.messageId, memoryReferences.semanticMemoryId],
      })
      .returning({ id: memoryReferences.id });
    if (!inserted.length) continue;

    recorded.push(semanticMemoryId);

    const prior = await db
      .select({ id: memoryReferences.id })
      .from(memoryReferences)
      .where(
        and(
          eq(memoryReferences.conversationId, input.conversation_id),
          eq(memoryReferences.semanticMemoryId, semanticMemoryId),
          ne(memoryReferences.messageId, input.message_id),
        ),
      )
      .limit(1);
    if (prior.length) continue;

    const weight = memoryReferenceWeight(createdAt);
    await db
      .update(semanticMemory)
      .set({
        referenceCount: drizzleSql`${semanticMemory.referenceCount} + ${weight}`,
        updated: new Date(formatCstIso()),
      })
      .where(eq(semanticMemory.id, semanticMemoryId));
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
      conversationId: messages.conversationId,
      content: drizzleSql<string>`btrim((${messages.payload})->>'content')`,
      timestamp: drizzleSql<string | null>`(${messages.payload})->>'timestamp'`,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        drizzleSql`(${messages.payload})->>'role' IN ('user', 'assistant')`,
        drizzleSql`length(btrim((${messages.payload})->>'content')) > 0`,
        drizzleSql`COALESCE(${conversations.platformInfo}->>'platform', '') <> 'cron'`,
      ),
    );

  let inserted = 0;
  for (const row of rows) {
    const semanticMemoryIds = parseMemoryReferenceMarkers(row.content);
    if (!semanticMemoryIds.length) continue;

    const createdAt = row.timestamp ? new Date(row.timestamp) : new Date(formatCstIso());
    for (const semanticMemoryId of semanticMemoryIds) {
      const exists = await db
        .select({ id: semanticMemory.id })
        .from(semanticMemory)
        .where(eq(semanticMemory.id, semanticMemoryId))
        .limit(1);
      if (!exists.length) continue;

      const refs = await db
        .insert(memoryReferences)
        .values({
          messageId: row.id,
          semanticMemoryId,
          conversationId: row.conversationId,
          createdAt,
        })
        .onConflictDoNothing({
          target: [memoryReferences.messageId, memoryReferences.semanticMemoryId],
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
  await db.update(semanticMemory).set({ referenceCount: 0 });

  const rows = await db.select({
    semanticMemoryId: drizzleSql<string>`semantic_memory_id`,
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
      .set({ referenceCount: row.weightedCount, updated: now })
      .where(eq(semanticMemory.id, row.semanticMemoryId));
  }

  return { updated: rows.length, rebuilt };
}

export async function countReferencesBySemanticMemory(semanticMemoryId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(memoryReferences)
    .where(eq(memoryReferences.semanticMemoryId, semanticMemoryId));
  return Number(rows[0]?.count ?? 0);
}
