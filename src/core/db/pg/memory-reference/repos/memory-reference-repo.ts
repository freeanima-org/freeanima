import { and, eq, inArray, ne, sql as drizzleSql } from "drizzle-orm";
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
} from "@freeanima/core/db/pg/memory-reference/markers";

import { getDb } from "../../client.ts";

const REF_INSERT_CHUNK = 100;

export async function recordMessageReferences(
  input: RecordMessageReferencesInput,
): Promise<string[]> {
  const semantic_memory_ids = [...new Set(parseMemoryReferenceMarkers(input.content))];
  if (semantic_memory_ids.length === 0) return [];
  if (input.skip_reference_count) return [];

  const created_at = input.created_at ? new Date(input.created_at) : new Date(formatCstIso());
  const db = getDb();

  const existingRows = await db
    .select({ id: semanticMemory.id })
    .from(semanticMemory)
    .where(inArray(semanticMemory.id, semantic_memory_ids));
  const existingIds = existingRows.map((r) => r.id);
  if (existingIds.length === 0) return [];

  const inserted = await db
    .insert(memoryReferences)
    .values(
      existingIds.map((semantic_memory_id) => ({
        message_id: input.message_id,
        semantic_memory_id,
        conversation_id: input.conversation_id,
        created_at,
      })),
    )
    .onConflictDoNothing({
      target: [memoryReferences.message_id, memoryReferences.semantic_memory_id],
    })
    .returning({ semantic_memory_id: memoryReferences.semantic_memory_id });

  if (inserted.length === 0) return [];

  const recordedIds = inserted.map((r) => r.semantic_memory_id);

  const priorRows = await db
    .select({ semantic_memory_id: memoryReferences.semantic_memory_id })
    .from(memoryReferences)
    .where(
      and(
        eq(memoryReferences.conversation_id, input.conversation_id),
        inArray(memoryReferences.semantic_memory_id, recordedIds),
        ne(memoryReferences.message_id, input.message_id),
      ),
    );
  const hasPrior = new Set(priorRows.map((r) => r.semantic_memory_id));
  const firstHits = recordedIds.filter((id) => !hasPrior.has(id));
  if (firstHits.length === 0) return recordedIds;

  const weight = memoryReferenceWeight(created_at);
  const now = new Date(formatCstIso());
  await db
    .update(semanticMemory)
    .set({
      reference_count: drizzleSql`${semanticMemory.reference_count} + ${weight}`,
      updated_at: now,
    })
    .where(inArray(semanticMemory.id, firstHits));

  return recordedIds;
}

/** Rescan `[[f-xxx]]` in message bodies, rebuild memory_references (full calibration) */
export async function rebuildMemoryReferencesFromMessages(): Promise<number> {
  const db = getDb();

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

  type PendingRef = {
    message_id: string;
    semantic_memory_id: string;
    conversation_id: string;
    created_at: Date;
  };
  const pending: PendingRef[] = [];
  const markerIds = new Set<string>();

  for (const row of rows) {
    const semantic_memory_ids = parseMemoryReferenceMarkers(row.content);
    if (semantic_memory_ids.length === 0) continue;
    const created_at = row.timestamp ? new Date(row.timestamp) : new Date(formatCstIso());
    for (const semantic_memory_id of semantic_memory_ids) {
      markerIds.add(semantic_memory_id);
      pending.push({
        message_id: row.id,
        semantic_memory_id,
        conversation_id: row.conversation_id,
        created_at,
      });
    }
  }

  const validIds = new Set<string>();
  if (markerIds.size > 0) {
    const idList = [...markerIds];
    for (let i = 0; i < idList.length; i += REF_INSERT_CHUNK) {
      const chunk = idList.slice(i, i + REF_INSERT_CHUNK);
      const existing = await db
        .select({ id: semanticMemory.id })
        .from(semanticMemory)
        .where(inArray(semanticMemory.id, chunk));
      for (const row of existing) validIds.add(row.id);
    }
  }

  const toInsert = pending.filter((p) => validIds.has(p.semantic_memory_id));

  // 差分重建：先落新表数据前清空；短事务降低与在线写窗口的重叠
  await db.transaction(async (tx) => {
    await tx.delete(memoryReferences);
    for (let i = 0; i < toInsert.length; i += REF_INSERT_CHUNK) {
      const chunk = toInsert.slice(i, i + REF_INSERT_CHUNK);
      if (chunk.length === 0) continue;
      await tx
        .insert(memoryReferences)
        .values(chunk)
        .onConflictDoNothing({
          target: [memoryReferences.message_id, memoryReferences.semantic_memory_id],
        });
    }
  });

  return toInsert.length;
}

export async function syncAllReferenceCounts(): Promise<{ updated: number; rebuilt: number }> {
  const rebuilt = await rebuildMemoryReferencesFromMessages();
  const db = getDb();
  const now = new Date(formatCstIso());

  // 单语句：全表 reference_count 按 dedupe+衰减 CTE 写回；无命中者置 0
  await db.update(semanticMemory).set({
    reference_count: drizzleSql`COALESCE((
      WITH deduped AS (
        SELECT DISTINCT ON (conversation_id, semantic_memory_id)
          conversation_id,
          semantic_memory_id,
          created_at
        FROM memory_references
        WHERE semantic_memory_id = ${semanticMemory.id}
        ORDER BY conversation_id, semantic_memory_id, created_at DESC
      )
      SELECT SUM(
        CASE
          WHEN created_at >= NOW() - INTERVAL '30 days' THEN 2.0
          ELSE 1.0
        END
      )::float8
      FROM deduped
    ), 0)`,
    updated_at: now,
  });

  const countRows = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(semanticMemory)
    .where(drizzleSql`${semanticMemory.reference_count} > 0`);

  return { updated: Number(countRows[0]?.count ?? 0), rebuilt };
}

export async function countReferencesBySemanticMemory(semantic_memory_id: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(memoryReferences)
    .where(eq(memoryReferences.semantic_memory_id, semantic_memory_id));
  return Number(rows[0]?.count ?? 0);
}
