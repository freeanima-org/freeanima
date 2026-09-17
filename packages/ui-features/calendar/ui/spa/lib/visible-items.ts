import type { CalendarRangeItem } from "./api.ts";

/** 「重复展开」关闭时隐藏任务虚拟实例；事件/项目不受影响。 */
export function filterVisibleCalendarItems(
  items: CalendarRangeItem[],
  expandRecurrence: boolean,
): CalendarRangeItem[] {
  if (expandRecurrence) return items;
  return items.filter((item) => item.kind !== "task" || !item.virtual);
}
