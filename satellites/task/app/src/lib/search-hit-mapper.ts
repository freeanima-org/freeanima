import type { TaskItemRow } from "./api.ts";

type EntitySearchApiRow = {
  id: number;
  title: string;
  content?: string;
  body?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

const PRIORITIES = new Set<TaskItemRow["priority"]>(["high", "medium", "low", "none"]);

function readPriority(raw: unknown): TaskItemRow["priority"] {
  return typeof raw === "string" && PRIORITIES.has(raw as TaskItemRow["priority"])
    ? (raw as TaskItemRow["priority"])
    : "none";
}

/** 将 entity search API 命中行转为任务 UI 行 */
export function entitySearchHitToTaskItem(row: EntitySearchApiRow): TaskItemRow | null {
  const body = row.body ?? {};
  const listId = Number(body.list_id);
  if (!Number.isFinite(listId) || listId <= 0) return null;

  const status = body.status === "completed" ? "completed" : "pending";
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];

  return {
    id: row.id,
    title: row.title,
    content: row.content ?? "",
    tags,
    status,
    priority: readPriority(body.priority),
    due_at: typeof body.due_at === "string" ? body.due_at : null,
    list_id: listId,
    sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
    completed_at: typeof body.completed_at === "string" ? body.completed_at : null,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}
