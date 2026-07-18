import type { TaskItemRowPayload } from "@freeanima/shared/sap-contract/frames/task.ts";

/** 搜索/全局视图中的任务归属标签 */
export function taskAttributionLabel(item: TaskItemRowPayload): string {
  if (item.project_id != null) {
    return `项目 / ${item.project_title ?? item.project_id}`;
  }
  return `清单 / ${item.list_name ?? item.list_id ?? "—"}`;
}
