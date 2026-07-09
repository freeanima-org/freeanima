import type { TaskItemPriority } from "@freeanima/core/db/schema/entity";

import type { TaskItemRow, TaskListRow } from "./types.ts";

export const TASK_PRIORITIES: TaskItemPriority[] = ["high", "medium", "low", "none"];

export function parsePriority(raw: unknown): TaskItemPriority | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw);
  return TASK_PRIORITIES.includes(s as TaskItemPriority) ? (s as TaskItemPriority) : undefined;
}

export function parseWorldId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

export const WORLD_ID_TOOL_PROPERTY = {
  type: "integer",
  description: "Owning world id (see system prompt: user_world_id / agent_world_id)",
} as const;

export function parseTags(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export function itemPayload(item: TaskItemRow) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    tags: item.tags,
    status: item.status,
    priority: item.priority,
    due_at: item.due_at,
    remind_at: item.remind_at,
    list_id: item.list_id,
    project_id: item.project_id ?? null,
    milestone_id: item.milestone_id ?? null,
    project_title: item.project_title ?? null,
    list_name: item.list_name ?? null,
    sort_order: item.sort_order,
    completed_at: item.completed_at,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function listPayload(list: TaskListRow) {
  return {
    id: list.id,
    name: list.name,
    sort_order: list.sort_order,
    closed: list.closed,
    is_default: list.is_default,
    is_folder: list.is_folder,
    parent_id: list.parent_id,
    item_count: list.item_count,
  };
}
