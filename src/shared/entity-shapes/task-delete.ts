import { TASK_ITEM_COMPONENT } from "./component-ids.ts";

/**
 * 与 `deleteTaskItem` 一致：primary 不是 task_item 时删除只卸组件，载体实体保留。
 * UI 确认文案与后端共用此判断。
 */
export function taskDeleteDetachesCarrier(primaryComponent: string | null | undefined): boolean {
  return primaryComponent != null && primaryComponent !== TASK_ITEM_COMPONENT;
}
