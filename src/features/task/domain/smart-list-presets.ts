import type { TaskItemSearchFilters } from "@freeanima/core/db/schema";

export const SMART_LIST_PRESETS = [
  "due_today",
  "due_tomorrow",
  "due_next_7d",
  "done_today",
  "done_yesterday",
  "done_last_7d",
] as const;

export type SmartListPreset = (typeof SMART_LIST_PRESETS)[number];

export type BuiltinSmartListDefinition = {
  preset: SmartListPreset;
  title: string;
  sort_order: number;
  filters: TaskItemSearchFilters;
};

export const BUILTIN_SMART_LIST_DEFINITIONS: readonly BuiltinSmartListDefinition[] = [
  {
    preset: "due_today",
    title: "今天",
    sort_order: 0,
    filters: { status: "pending", has_due_at: true, due_on_or_before_days: 0 },
  },
  {
    preset: "due_tomorrow",
    title: "明天",
    sort_order: 1,
    filters: { status: "pending", due_on: "tomorrow" },
  },
  {
    preset: "due_next_7d",
    title: "未来7天",
    sort_order: 2,
    filters: { status: "pending", has_due_at: true, due_on_or_before_days: 7 },
  },
  {
    preset: "done_today",
    title: "今日完成",
    sort_order: 3,
    filters: { status: "completed", completed_on: "today" },
  },
  {
    preset: "done_yesterday",
    title: "昨日完成",
    sort_order: 4,
    filters: { status: "completed", completed_on: "yesterday" },
  },
  {
    preset: "done_last_7d",
    title: "最近7天完成",
    sort_order: 5,
    filters: { status: "completed", completed_on_or_after_days: 6 },
  },
] as const;

export const DEFAULT_SMART_LIST_PRESET: SmartListPreset = "due_today";

export function listBuiltinSmartListRows(): Array<{
  preset: SmartListPreset;
  title: string;
  sort_order: number;
  filters: TaskItemSearchFilters;
}> {
  return BUILTIN_SMART_LIST_DEFINITIONS.map((def) => ({
    preset: def.preset,
    title: def.title,
    sort_order: def.sort_order,
    filters: def.filters,
  }));
}

export function findBuiltinSmartListByPreset(
  preset: string,
): (typeof BUILTIN_SMART_LIST_DEFINITIONS)[number] | undefined {
  return BUILTIN_SMART_LIST_DEFINITIONS.find((def) => def.preset === preset);
}
