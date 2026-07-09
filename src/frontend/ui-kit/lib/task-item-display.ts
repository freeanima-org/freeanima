export type TaskItemPriority = "high" | "medium" | "low" | "none";
export type TaskItemStatus = "pending" | "completed";

/** 任务列表/详情 UI 的最小字段集（feature 层 row 类型可结构兼容） */
export type TaskItemDisplay = {
  id: number;
  title: string;
  content: string;
  tags: string[];
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
  return { ...item, tags: [...item.tags] };
}

export function isTaskItemDisplayEqual(a: TaskItemDisplay, b: TaskItemDisplay): boolean {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.priority === b.priority &&
    a.due_at === b.due_at &&
    a.tags.length === b.tags.length &&
    a.tags.every((t, i) => t === b.tags[i])
  );
}

export function isTaskItemDisplayDirty(
  current: TaskItemDisplay,
  baseline: TaskItemDisplay,
): boolean {
  return !isTaskItemDisplayEqual(current, baseline);
}
