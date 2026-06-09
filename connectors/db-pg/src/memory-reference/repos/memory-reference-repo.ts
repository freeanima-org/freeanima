import { and, eq, ne, sql as drizzleSql } from "drizzle-orm";
import { memoryReferences, semanticMemory } from "@freeanima/engine-db/schema";
import { formatCstIso } from "@freeanima/kernel-util";
import type { RecordMessageReferencesInput } from "@freeanima/engine-repos";
import {
  parseMemoryReferenceMarkers,
  memoryReferenceWeight,
} from "@freeanima/life-memory/memory-reference";

import { getDb } from "../../client.ts";

export async function recordMessageReferences(
  input: RecordMessageReferencesInput,
): Promise<string[]> {
  const semanticMemoryIds = parseMemoryReferenceMarkers(input.content);
  if (!semanticMemoryIds.length) return [];

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
        sessionId: input.session_id,
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
          eq(memoryReferences.sessionId, input.session_id),
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

/** 从 messages 正文重扫 `[记忆 #xxx]`，重建 memory_references（全量校准） */
export async function rebuildMemoryReferencesFromMessages(): Promise<number> {
  const db = getDb();
  await db.delete(memoryReferences);

  const rows = await db.execute<{
    id: string;
    session_id: string;
    content: string;
    timestamp: string | null;
  }>(drizzleSql`
    SELECT
      m.id,
      m.session_id,
      btrim((m.payload)->>'content') AS content,
      (m.payload)->>'timestamp' AS timestamp
    FROM messages m
    WHERE (m.payload)->>'role' IN ('user', 'assistant')
      AND length(btrim((m.payload)->>'content')) > 0
  `);

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
          sessionId: row.session_id,
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

  const rows = await db.execute<{ semantic_memory_id: string; weighted_count: number }>(drizzleSql`
    WITH deduped AS (
      SELECT DISTINCT ON (session_id, semantic_memory_id)
        session_id,
        semantic_memory_id,
        created_at
      FROM memory_references
      ORDER BY session_id, semantic_memory_id, created_at DESC
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
  `);

  const now = new Date(formatCstIso());
  for (const row of rows) {
    await db
      .update(semanticMemory)
      .set({ referenceCount: row.weighted_count, updated: now })
      .where(eq(semanticMemory.id, row.semantic_memory_id));
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
