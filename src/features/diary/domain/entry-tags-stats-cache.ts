import {
  REDIS_CACHE_KEY_PREFIX,
  cacheGetJson,
  cacheSetJson,
} from "@freeanima/platform/connectors/redis";
import type { DiaryEntryTagSuggestion } from "@freeanima/core/db/pg/diary";

/** 日记实体级常用 tags 统计缓存（可丢弃）TTL：1 天 */
export const DIARY_ENTRY_TAGS_STATS_CACHE_TTL_SECONDS = 24 * 60 * 60;

export function diaryEntryTagsStatsCacheKey(worldId: number, limit: number): string {
  return `${REDIS_CACHE_KEY_PREFIX}diary-entry-tags:world:${worldId}:top:${limit}`;
}

function isSuggestionList(value: unknown): value is DiaryEntryTagSuggestion[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (row) =>
      row != null &&
      typeof row === "object" &&
      typeof (row as DiaryEntryTagSuggestion).tag === "string" &&
      typeof (row as DiaryEntryTagSuggestion).count === "number",
  );
}

/** 读无 query 的常用 tags 统计缓存 */
export async function loadDiaryEntryTagsStatsCache(
  worldId: number,
  limit: number,
): Promise<DiaryEntryTagSuggestion[] | null> {
  const raw = await cacheGetJson<unknown>(diaryEntryTagsStatsCacheKey(worldId, limit));
  if (!isSuggestionList(raw)) return null;
  return raw;
}

export async function saveDiaryEntryTagsStatsCache(
  worldId: number,
  limit: number,
  items: DiaryEntryTagSuggestion[],
  ttlSeconds: number = DIARY_ENTRY_TAGS_STATS_CACHE_TTL_SECONDS,
): Promise<void> {
  await cacheSetJson(diaryEntryTagsStatsCacheKey(worldId, limit), items, ttlSeconds);
}
