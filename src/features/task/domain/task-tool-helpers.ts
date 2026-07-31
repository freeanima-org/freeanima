import type { TaskItemPriority } from "@freeanima/host/core/db/schema/entity";
import { ensureTagsByTitles } from "@freeanima/features/tag/domain";

import type { TaskItemRow, TaskListRow } from "./types.ts";

export const TASK_PRIORITIES: TaskItemPriority[] = ["high", "medium", "low", "none"];

export type ParseOk<T> = { ok: true; value: T };
export type ParseErr = { ok: false; error: string };
export type ParseResult<T> = ParseOk<T> | ParseErr;

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

/** 严格：须为正整数数组；非法元素（含字符串名）报错，禁止静默丢掉。 */
export function parseTagIds(raw: unknown): ParseResult<number[] | undefined> {
  if (raw == null) return { ok: true, value: undefined };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "tag_ids must be an array of positive integers" };
  }
  const out: number[] = [];
  for (const item of raw) {
    const id =
      typeof item === "number"
        ? item
        : typeof item === "string" && item.trim() !== ""
          ? Number(item.trim())
          : Number.NaN;
    if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
      return { ok: false, error: `invalid tag_ids element: ${String(item)}` };
    }
    out.push(id);
  }
  return { ok: true, value: out };
}

/** 严格：须为数组；元素 coerce 为 string 并 trim，空串跳过。 */
export function parseTagTitles(raw: unknown): ParseResult<string[] | undefined> {
  if (raw == null) return { ok: true, value: undefined };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "tags must be an array of strings" };
  }
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if (s) out.push(s);
  }
  return { ok: true, value: out };
}

function mergeTagIds(parts: number[][]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    for (const id of part) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** 解析 args.tags / args.tag_ids；未传二者时 value 为 undefined。 */
export async function resolveToolTagIds(
  worldId: number,
  args: Record<string, unknown>,
): Promise<ParseResult<number[] | undefined>> {
  if (args.tags === undefined && args.tag_ids === undefined) {
    return { ok: true, value: undefined };
  }

  const parts: number[][] = [];

  if (args.tag_ids !== undefined) {
    const parsed = parseTagIds(args.tag_ids);
    if (!parsed.ok) return parsed;
    parts.push(parsed.value ?? []);
  }

  if (args.tags !== undefined) {
    const parsed = parseTagTitles(args.tags);
    if (!parsed.ok) return parsed;
    try {
      parts.push(await ensureTagsByTitles(worldId, parsed.value ?? []));
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  }

  return { ok: true, value: mergeTagIds(parts) };
}

export function itemPayload(item: TaskItemRow) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    tag_ids: item.tag_ids,
    status: item.status,
    priority: item.priority,
    due_at: item.due_at,
    remind_at: item.remind_at,
    list_id: item.list_id,
    project_id: item.project_id ?? null,
    project_title: item.project_title ?? null,
    list_name: item.list_name ?? null,
    sort_order: item.sort_order,
    completed_at: item.completed_at,
    recurrence: item.recurrence ?? null,
    occurrence_id: item.occurrence_id,
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
  };
}
