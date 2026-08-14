import { and, eq, inArray, ne, sql as drizzleSql } from "drizzle-orm";
import { messages, entities, conversations } from "@freeanima/habitat/core/db/schema";
import { formatCstIso } from "@freeanima/habitat/core/util";
import type { RecordMessageReferencesInput } from "../types.ts";
import {
  parseMemoryReferenceMarkers,
  memoryReferenceWeight,
} from "@freeanima/habitat/core/db/pg/memory-reference/markers";
import {
  peekActiveRuntimeConfig,
  resolveMemoryReferenceConfig,
} from "@freeanima/habitat/core/config";

import { getDb } from "../../client.ts";

const SCAN_CHUNK = 100;

function referenceWeightOpts() {
  const ref = resolveMemoryReferenceConfig(peekActiveRuntimeConfig()?.data);
  return {
    decayDays: ref.decay_days,
    recentWeight: ref.recent_weight,
    staleWeight: ref.stale_weight,
  };
}

/**
 * #16102：不再写 memory_references 边表；仅 bump entities.reference_count。
 * 主路径亦经 MemoryService.syncTurn.cite；本函数保留 appendMessage 兼容。
 */
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

  const weight = memoryReferenceWeight(created_at, new Date(), referenceWeightOpts());
  const now = new Date(formatCstIso());
  await db
    .update(entities)
    .set({
      reference_count: drizzleSql`${entities.reference_count} + ${weight}`,
      updated_at: now,
    })
    .where(inArray(entities.id, existingIds));

  return existingIds;
}

type MarkerHit = { entity_id: number; created_at: Date };

/** 从 messages 正文重算引用权重（无边表） */
async function collectMarkerHitsFromMessages(): Promise<MarkerHit[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: messages.id,
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

  const hits: MarkerHit[] = [];
  const markerIds = new Set<number>();
  for (const row of rows) {
    const entity_ids = parseMemoryReferenceMarkers(row.content);
    if (entity_ids.length === 0) continue;
    const created_at = row.timestamp ? new Date(row.timestamp) : new Date(formatCstIso());
    for (const entity_id of entity_ids) {
      markerIds.add(entity_id);
      hits.push({ entity_id, created_at });
    }
  }

  if (markerIds.size === 0) return [];

  const validIds = new Set<number>();
  const idList = [...markerIds];
  for (let i = 0; i < idList.length; i += SCAN_CHUNK) {
    const chunk = idList.slice(i, i + SCAN_CHUNK);
    const existing = await db
      .select({ id: entities.id })
      .from(entities)
      .where(inArray(entities.id, chunk));
    for (const row of existing) validIds.add(row.id);
  }

  return hits.filter((h) => validIds.has(h.entity_id));
}

/**
 * 全量校准：扫描消息标记 → 重写 entities.reference_count。
 * @returns 命中的 (message, entity) 对数（兼容旧 rebuilt 语义）
 */
export async function rebuildMemoryReferencesFromMessages(): Promise<number> {
  const hits = await collectMarkerHitsFromMessages();
  await applyReferenceCountsFromHits(hits);
  return hits.length;
}

async function applyReferenceCountsFromHits(hits: MarkerHit[]): Promise<void> {
  const db = getDb();
  const now = new Date(formatCstIso());
  const ref = resolveMemoryReferenceConfig(peekActiveRuntimeConfig()?.data);
  const windowMs = ref.decay_days * 24 * 60 * 60 * 1000;
  const weights = new Map<number, number>();

  for (const hit of hits) {
    const ageMs = now.getTime() - hit.created_at.getTime();
    const w = ageMs <= windowMs ? ref.recent_weight : ref.stale_weight;
    weights.set(hit.entity_id, (weights.get(hit.entity_id) ?? 0) + w);
  }

  await db
    .update(entities)
    .set({ reference_count: 0, updated_at: now })
    .where(ne(entities.reference_count, 0));

  for (const [entity_id, w] of weights) {
    await db
      .update(entities)
      .set({ reference_count: w, updated_at: now })
      .where(eq(entities.id, entity_id));
  }
}

export async function syncAllReferenceCounts(): Promise<{ updated: number; rebuilt: number }> {
  const hits = await collectMarkerHitsFromMessages();
  await applyReferenceCountsFromHits(hits);
  const db = getDb();
  const countRows = await db
    .select({ count: drizzleSql<number>`count(*)::int` })
    .from(entities)
    .where(drizzleSql`${entities.reference_count} > 0`);
  return { updated: countRows[0]?.count ?? 0, rebuilt: hits.length };
}

/** 统计某实体在消息正文中的引用次数（非边表行数） */
export async function countReferencesBySemanticMemory(entity_id: number): Promise<number> {
  const hits = await collectMarkerHitsFromMessages();
  return hits.filter((h) => h.entity_id === entity_id).length;
}
