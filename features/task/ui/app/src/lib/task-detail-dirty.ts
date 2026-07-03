import type { TaskItemRow } from "./api.ts";

export function cloneTaskItem(item: TaskItemRow): TaskItemRow {
  return { ...item, tags: [...item.tags] };
}

export function isTaskItemDirty(current: TaskItemRow, baseline: TaskItemRow): boolean {
  return (
    current.title !== baseline.title ||
    current.content !== baseline.content ||
    current.priority !== baseline.priority ||
    current.due_at !== baseline.due_at ||
    current.tags.length !== baseline.tags.length ||
    current.tags.some((tag, index) => tag !== baseline.tags[index])
  );
}

export function isTaskItemEqual(a: TaskItemRow, b: TaskItemRow): boolean {
  return !isTaskItemDirty(a, b);
}
