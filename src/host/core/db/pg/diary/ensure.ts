import {
  DIARY_ENTRY_COMPONENT,
  asDiaryEntry,
  type DiaryEntryBody,
} from "@freeanima/host/core/db/schema/entity";
import { formatCstIso } from "@freeanima/host/core/util";
import { createEntity, searchEntities } from "@freeanima/host/core/db/pg/entity";

export function diaryDayKey(entryAtOrDay: string): string {
  return entryAtOrDay.trim().slice(0, 10);
}

export function diaryEntryAtNoon(day: string): string {
  const d = diaryDayKey(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error(`invalid diary day: ${day}`);
  }
  return `${d}T12:00:00+08:00`;
}

export function titleFromDiaryDay(day: string): string {
  const entryAt = diaryEntryAtNoon(day);
  const date = new Date(entryAt);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("zh-CN");
}

/** CST 日历日 YYYY-MM-DD（来自 timestamptz / ISO） */
export function cstCalendarDay(date: Date | string): string {
  if (typeof date === "string") {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      // 已是日历日或带时区的 ISO：优先用 CST 格式化
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) return formatCstIso(parsed).slice(0, 10);
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) throw new Error(`invalid date: ${date}`);
    return formatCstIso(parsed).slice(0, 10);
  }
  return formatCstIso(date).slice(0, 10);
}

export type EnsuredDiaryEntry = {
  id: number;
  world_id: number;
  entry_at: string;
  title: string;
  created: boolean;
};

async function findDiaryIdByDay(worldId: number, day: string): Promise<number | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: DIARY_ENTRY_COMPONENT,
    filters: {
      entry_after: `${day}T00:00:00+08:00`,
      entry_before: `${day}T23:59:59+08:00`,
    },
    limit: 20,
    mode: "filter_only",
    include_count: false,
  });
  for (const row of result.results) {
    const parsed = asDiaryEntry(row);
    if (parsed && diaryDayKey(parsed.entry_at) === day) return parsed.id;
  }
  return null;
}

/**
 * 同 world 按 CST 日 ensure diary_entry；不存在则建空壳（content 空）。
 */
export async function ensureDiaryEntryForDay(
  worldId: number,
  day: string,
): Promise<EnsuredDiaryEntry> {
  const dayKey = diaryDayKey(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    throw new Error(`invalid diary day: ${day}`);
  }

  const existingId = await findDiaryIdByDay(worldId, dayKey);
  if (existingId != null) {
    return {
      id: existingId,
      world_id: worldId,
      entry_at: diaryEntryAtNoon(dayKey),
      title: titleFromDiaryDay(dayKey),
      created: false,
    };
  }

  const entryAt = diaryEntryAtNoon(dayKey);
  const body: DiaryEntryBody = {
    entry_at: entryAt,
    client_op_id: null,
  };
  const title = titleFromDiaryDay(dayKey);
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [DIARY_ENTRY_COMPONENT],
    primary_component: DIARY_ENTRY_COMPONENT,
    title,
    summary: "",
    content: "",
    tag_ids: [],
    body,
  });
  const parsed = asDiaryEntry(row);
  if (!parsed) throw new Error("diary entry create failed");
  return {
    id: parsed.id,
    world_id: worldId,
    entry_at: parsed.entry_at,
    title: row.title,
    created: true,
  };
}
