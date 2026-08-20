import type { TaskItemSearchFilters } from "@freeanima/habitat/core/db/schema";

/** 历史 preset 字面量（URL/契约兼容）；内置入口已退役，完成回顾改到日程 */
export const SMART_LIST_PRESETS = ["done_today", "done_yesterday", "done_last_7d"] as const;

export type SmartListPreset = (typeof SMART_LIST_PRESETS)[number];

export type BuiltinSmartListDefinition = {
  preset: SmartListPreset;
  title: string;
  sort_order: number;
  filters: TaskItemSearchFilters;
};

/** 不再注入侧栏；保留类型供旧 selection 解析回退 */
export const BUILTIN_SMART_LIST_DEFINITIONS: readonly BuiltinSmartListDefinition[] = [];

export function listBuiltinSmartListRows(): Array<{
  preset: SmartListPreset;
  title: string;
  sort_order: number;
  filters: TaskItemSearchFilters;
}> {
  return [];
}

export function findBuiltinSmartListByPreset(
  _preset: string,
): BuiltinSmartListDefinition | undefined {
  return undefined;
}
