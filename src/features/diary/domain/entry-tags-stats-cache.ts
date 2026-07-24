import { DIARY_ENTRY_COMPONENT } from "@freeanima/core/db/schema";
import type { TagSuggestion } from "@freeanima/core/db/pg/tag";

import {
  TAG_SUGGEST_STATS_CACHE_TTL_SECONDS,
  loadTagSuggestStatsCache,
  saveTagSuggestStatsCache,
  tagSuggestStatsCacheKey,
} from "@freeanima/features/tag/domain/tag-suggest-cache.ts";

/** @deprecated 请用 TAG_SUGGEST_STATS_CACHE_TTL_SECONDS */
export const DIARY_ENTRY_TAGS_STATS_CACHE_TTL_SECONDS = TAG_SUGGEST_STATS_CACHE_TTL_SECONDS;

/** @deprecated 请用 tagSuggestStatsCacheKey(worldId, "diary_entry", limit) */
export function diaryEntryTagsStatsCacheKey(worldId: number, limit: number): string {
  return tagSuggestStatsCacheKey(worldId, DIARY_ENTRY_COMPONENT, limit);
}

/** @deprecated 请用 loadTagSuggestStatsCache */
export async function loadDiaryEntryTagsStatsCache(
  worldId: number,
  limit: number,
): Promise<TagSuggestion[] | null> {
  return loadTagSuggestStatsCache(worldId, DIARY_ENTRY_COMPONENT, limit);
}

/** @deprecated 请用 saveTagSuggestStatsCache */
export async function saveDiaryEntryTagsStatsCache(
  worldId: number,
  limit: number,
  items: TagSuggestion[],
  ttlSeconds: number = TAG_SUGGEST_STATS_CACHE_TTL_SECONDS,
): Promise<void> {
  await saveTagSuggestStatsCache(worldId, DIARY_ENTRY_COMPONENT, limit, items, ttlSeconds);
}
