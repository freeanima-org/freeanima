import type { TaskItemSearchFilters } from "@freeanima/habitat/core/db/schema";

export const SMART_LIST_PRESETS = ["done_today", "done_yesterday", "done_last_7d"] as const;

export type SmartListPreset = (typeof SMART_LIST_PRESETS)[number];

export type BuiltinSmartListDefinition = {
  preset: SmartListPreset;
  title: string;
  sort_order: number;
  filters: TaskItemSearchFilters;
};

export const BUILTIN_SMART_LIST_DEFINITIONS: readonly BuiltinSmartListDefinition[] = [
  {
    preset: "done_today",
    title: "今日完成",
    sort_order: 0,
    filters: { status: "completed", completed_on: "today", in_backlog: true },
  },
  {
    preset: "done_yesterday",
    title: "昨日完成",
    sort_order: 1,
    filters: { status: "completed", completed_on: "yesterday", in_backlog: true },
  },
  {
    preset: "done_last_7d",
    title: "最近7天完成",
    sort_order: 2,
    filters: { status: "completed", completed_on_or_after_days: 6, in_backlog: true },
  },
] as const;

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
