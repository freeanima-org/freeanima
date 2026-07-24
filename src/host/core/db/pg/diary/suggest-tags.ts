import { DIARY_ENTRY_COMPONENT } from "@freeanima/host/core/db/schema";

import { suggestTagsByPrimaryComponent, type TagSuggestion } from "../tag/suggest-tags.ts";

/** @deprecated 请用 `@freeanima/host/core/db/pg/tag` 的 TagSuggestion */
export type DiaryEntryTagSuggestion = TagSuggestion;

/** 本 world 日记实体 tag_ids 引用频次；无 query 时 topN，有 query 时 ILIKE title */
export async function suggestDiaryEntryTags(
  worldId: number,
  opts?: { query?: string; limit?: number },
): Promise<DiaryEntryTagSuggestion[]> {
  return suggestTagsByPrimaryComponent(worldId, DIARY_ENTRY_COMPONENT, opts);
}
