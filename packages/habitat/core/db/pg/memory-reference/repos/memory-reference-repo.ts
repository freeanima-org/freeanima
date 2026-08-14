import { and, eq, inArray, ne, notExists, sql as drizzleSql } from "drizzle-orm";
import {
  memoryReferences,
  messages,
  entities,
  conversations,
} from "@freeanima/habitat/core/db/schema";
import { formatCstIso } from "@freeanima/habitat/core/util";
import type { RecordMessageReferencesInput } from "../types.ts";
import {
  parseMemoryReferenceMarkers,
  memoryReferenceWeight,
  MEMORY_REFERENCE_DECAY_DAYS,
  MEMORY_REFERENCE_RECENT_WEIGHT,
  MEMORY_REFERENCE_STALE_WEIGHT,
} from "@freeanima/habitat/core/db/pg/memory-reference/markers";

import { getDb } from "../../client.ts";

const REF_INSERT_CHUNK = 100;

export async function recordMessageReferences(
  input: RecordMessageReferencesInput,
): Promise<number[]> {
  const entity_ids = [...new Set(parseMemoryReferenceMarkers(input.content))];
  if (entity_ids.length === 0) return [];
  if (input.skip_reference_count) return [];

  const created_at = input.created_at ? new Date(input.created_at) : new Date(formatCstIso());
  const db = getDb();

  const existingRows = await db
    .select({ id: entities.id })
    .from(entities)
    .where(inArray(entities.id, entity_ids));
  const existingIds = existingRows.map((r) => r.id);
  if (existingIds.length === 0) return [];

  const inserted = await db
    .insert(memoryReferences)
    .values(
      existingIds.map((entity_id) => ({
        message_id: input.message_id,
        entity_id,
        conversation_id: input.conversation_id,
        created_at,
      })),
    )
    .onConflictDoNothing({
      target: [memoryReferences.message_id, memoryReferences.entity_id],
    })
    .returning({ entity_id: memoryReferences.entity_id });

  if (inserted.length === 0) return [];

  const recordedIds = inserted.map((r) => r.entity_id);

  // 每条消息计一次：无同 conversation 去重
  const weight = memoryReferenceWeight(created_at);
  const now = new Date(formatCstIso());
  await db
    .update(entities)
    .set({
      reference_count: drizzleSql`${entities.reference_count} + ${weight}`,
      updated_at: now,
    })
    .where(inArray(entities.id, recordedIds));

  return recordedIds;
}

/** Rescan `[[anima:id]]` in message bodies, rebuild memory_references (full calibration) */
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
    entity_id: number;
    conversation_id: string;
    created_at: Date;
  };
  const pending: PendingRef[] = [];
  const markerIds = new Set<number>();

  for (const row of rows) {
    const entity_ids = parseMemoryReferenceMarkers(row.content);
    if (entity_ids.length === 0) continue;
    const created_at = row.timestamp ? new Date(row.timestamp) : new Date(formatCstIso());
    for (const entity_id of entity_ids) {
      markerIds.add(entity_id);
      pending.push({
        message_id: row.id,
        entity_id,
        conversation_id: row.conversation_id,
        created_at,
      });
    }
  }

  const validIds = new Set<number>();
  if (markerIds.size > 0) {
    const idList = [...markerIds];
    for (let i = 0; i < idList.length; i += REF_INSERT_CHUNK) {
      const chunk = idList.slice(i, i + REF_INSERT_CHUNK);
      const existing = await db
        .select({ id: entities.id })
        .from(entities)
        .where(inArray(entities.id, chunk));
      for (const row of existing) validIds.add(row.id);
    }
  }

  const toInsert = pending.filter((p) => validIds.has(p.entity_id));

  await db.transaction(async (tx) => {
    await tx.delete(memoryReferences);
    for (let i = 0; i < toInsert.length; i += REF_INSERT_CHUNK) {
      const chunk = toInsert.slice(i, i + REF_INSERT_CHUNK);
      if (chunk.length === 0) continue;
      await tx
        .insert(memoryReferences)
        .values(chunk)
        .onConflictDoNothing({
          target: [memoryReferences.message_id, memoryReferences.entity_id],
        });
    }
  });

  return toInsert.length;
}

export async function syncAllReferenceCounts(): Promise<{ updated: number; rebuilt: number }> {
  const rebuilt = await rebuildMemoryReferencesFromMessages();
  const db = getDb();
  const now = new Date(formatCstIso());

  // 集合式重算：先按 memory_references 聚合写入，再清零无引用且 count≠0 的行
  const weightAgg = db
    .select({
      entity_id: memoryReferences.entity_id,
      w: drizzleSql<number>`SUM(
        CASE
          WHEN ${memoryReferences.created_at} >= NOW() - (${MEMORY_REFERENCE_DECAY_DAYS} * INTERVAL '1 day')
          THEN ${MEMORY_REFERENCE_RECENT_WEIGHT}::float8
          ELSE ${MEMORY_REFERENCE_STALE_WEIGHT}::float8
        END
      )::float8`.as("w"),
    })
    .from(memoryReferences)
    .groupBy(memoryReferences.entity_id)
    .as("ref_weights");

  await db
    .update(entities)
    .set({
      reference_count: drizzleSql`${weightAgg.w}`,
      updated_at: now,
    })
    .from(weightAgg)
    .where(eq(entities.id, weightAgg.entity_id));

  await db
    .update(entities)
    .set({
      reference_count: 0,
      updated_at: now,
    })
    .where(
      and(
        ne(entities.reference_count, 0),
        notExists(
          db
            .select({ one: drizzleSql`1` })
            .from(memoryReferences)
            .where(eq(memoryReferences.entity_id, entities.id)),
        ),
      ),
    );

  const countRows = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .where(drizzleSql`${entities.reference_count} > 0`);

  return { updated: countRows[0]?.count ?? 0, rebuilt };
}

export async function countReferencesBySemanticMemory(entity_id: number): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(memoryReferences)
    .where(eq(memoryReferences.entity_id, entity_id));
  return rows[0]?.count ?? 0;
}
