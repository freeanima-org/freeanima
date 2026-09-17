import type { TaskItemRow } from "./api.ts";

/** overlay 文本/元数据落盘：不含 status（完成走 complete/uncomplete） */
export type TaskOverlayFieldPatch = Pick<
  TaskItemRow,
  | "title"
  | "content"
  | "tag_ids"
  | "priority"
  | "start_at"
  | "end_at"
  | "due_at"
  | "remind_at"
  | "reminders"
  | "recurrence"
> & { only_this?: boolean };

export type TaskOverlayChangeKind = "status" | "fields";

/** 勾选完成是离散动作；其余字段才适合 debounce */
export function classifyTaskOverlayChange(
  prev: Pick<TaskItemRow, "status">,
  next: Pick<TaskItemRow, "status">,
): TaskOverlayChangeKind {
  return prev.status !== next.status ? "status" : "fields";
}

export function buildTaskOverlayFieldPatch(item: TaskItemRow): TaskOverlayFieldPatch {
  return {
    title: item.title,
    content: item.content,
    tag_ids: item.tag_ids,
    priority: item.priority,
    start_at: item.start_at ?? null,
    end_at: item.end_at ?? null,
    due_at: item.due_at,
    remind_at: item.remind_at ?? null,
    reminders: item.reminders ?? [],
    recurrence: item.recurrence ?? null,
    ...(item.recurrence ? { only_this: true } : {}),
  };
}
