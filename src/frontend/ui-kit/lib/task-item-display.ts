export type TaskItemPriority = "high" | "medium" | "low" | "none";
export type TaskItemStatus = "pending" | "completed";

/** 任务列表/详情 UI 的最小字段集（feature 层 row 类型可结构兼容） */
export type TaskItemDisplay = {
  id: number;
  title: string;
  content: string;
  tag_ids: number[];
  status: TaskItemStatus;
  priority: TaskItemPriority;
  due_at: string | null;
};

export function priorityDot(priority: TaskItemPriority): string {
  switch (priority) {
    case "high":
      return "text-error";
    case "medium":
      return "text-warning";
    case "low":
      return "text-info";
    default:
      return "text-base-content/30";
  }
}

export function cloneTaskItemDisplay<T extends TaskItemDisplay>(item: T): T {
  return { ...item, tag_ids: [...item.tag_ids] };
}

export function isTaskItemDisplayEqual(a: TaskItemDisplay, b: TaskItemDisplay): boolean {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.due_at === b.due_at &&
    a.tag_ids.length === b.tag_ids.length &&
    a.tag_ids.every((t, i) => t === b.tag_ids[i])
  );
}

export function isTaskItemDisplayDirty(
  current: TaskItemDisplay,
  baseline: TaskItemDisplay,
): boolean {
  return !isTaskItemDisplayEqual(current, baseline);
}
