import { DIARY_ENTRY_COMPONENT, asDiaryEntry } from "@freeanima/host/core/db/schema/entity";
import { searchEntities } from "@freeanima/host/core/db/pg/entity";

import { diaryDayKey } from "@freeanima/host/core/db/pg/diary";

/** 只查找，不创建 */
export async function findDiaryIdOnly(worldId: number, day: string): Promise<number | null> {
  const dayKey = diaryDayKey(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  const result = await searchEntities({
    world_id: worldId,
    primary_component: DIARY_ENTRY_COMPONENT,
    filters: {
      entry_after: `${dayKey}T00:00:00+08:00`,
      entry_before: `${dayKey}T23:59:59+08:00`,
    },
    limit: 20,
    mode: "filter_only",
    include_count: false,
  });
  for (const row of result.results) {
    const parsed = asDiaryEntry(row);
    if (parsed && diaryDayKey(parsed.entry_at) === dayKey) return parsed.id;
  }
  return null;
}
