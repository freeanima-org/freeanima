import {
  REDIS_CACHE_KEY_PREFIX,
  cacheGetJson,
  cacheSetJson,
} from "@freeanima/platform/connectors/redis";
import type { TagSuggestion } from "@freeanima/core/db/pg/tag";

/** 按 primary_component 的常用 tags 统计缓存（可丢弃）TTL：1 天 */
export const TAG_SUGGEST_STATS_CACHE_TTL_SECONDS = 24 * 60 * 60;

export function tagSuggestStatsCacheKey(
  worldId: number,
  primaryComponent: string,
  limit: number,
): string {
  return `${REDIS_CACHE_KEY_PREFIX}tag-suggest:${primaryComponent}:world:${worldId}:top:${limit}`;
}

function isSuggestionList(value: unknown): value is TagSuggestion[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (row) =>
      row != null &&
      typeof row === "object" &&
      typeof (row as TagSuggestion).id === "number" &&
      typeof (row as TagSuggestion).title === "string" &&
      typeof (row as TagSuggestion).count === "number",
  );
}

/** 读无 query 的常用 tags 统计缓存 */
export async function loadTagSuggestStatsCache(
  worldId: number,
  primaryComponent: string,
  limit: number,
): Promise<TagSuggestion[] | null> {
  const raw = await cacheGetJson<unknown>(
    tagSuggestStatsCacheKey(worldId, primaryComponent, limit),
  );
  if (!isSuggestionList(raw)) return null;
  return raw;
}

export async function saveTagSuggestStatsCache(
  worldId: number,
  primaryComponent: string,
  limit: number,
  items: TagSuggestion[],
  ttlSeconds: number = TAG_SUGGEST_STATS_CACHE_TTL_SECONDS,
): Promise<void> {
  await cacheSetJson(tagSuggestStatsCacheKey(worldId, primaryComponent, limit), items, ttlSeconds);
}
