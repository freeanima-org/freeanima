import {
  completeTaskItem,
  createTaskItem,
  createTaskList,
  deleteTaskItem,
  deleteTaskList,
  listTaskItems,
  listTaskLists,
  uncompleteTaskItem,
  updateTaskItem,
  updateTaskList,
} from "@freeanima/capabilities-task";

import { isPostgresPrimary } from "@freeanima/core/db/pg";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

export async function serviceTasklistList(deps: RuntimeDeps, input?: { include_closed?: boolean }) {
  assertPg(deps);
  const lists = await listTaskLists({ includeClosed: input?.include_closed });
  return { lists };
}

export async function serviceTasklistCreate(
  deps: RuntimeDeps,
  input: { name: string; sort_order?: number; color?: string | null },
) {
  assertPg(deps);
  const item = await createTaskList(input);
  return { item };
}

export async function serviceTasklistPatch(
  deps: RuntimeDeps,
  input: {
    id: number;
    name?: string;
    sort_order?: number;
    closed?: boolean;
    color?: string | null;
  },
) {
  assertPg(deps);
  const { id, ...patch } = input;
  const item = await updateTaskList({ id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTasklistDelete(
  deps: RuntimeDeps,
  input: { id: number; cascade?: boolean },
) {
  assertPg(deps);
  try {
    const ok = await deleteTaskList(input.id, { cascade: input.cascade ?? true });
    if (!ok) throw new Error("NOT_FOUND");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("default task list")) {
      throw new Error("DEFAULT_LIST_CANNOT_DELETE");
    }
    throw err;
  }
}

export async function serviceTaskList(
  deps: RuntimeDeps,
  input: {
    list_id?: number;
    status?: "pending" | "completed" | "all";
    due_today?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const items = await listTaskItems({
    list_id: input.list_id,
    status: input.status ?? "all",
    due_today: input.due_today,
    tags: input.tags,
    limit: input.limit,
    offset: input.offset,
  });
  return { items };
}

export async function serviceTaskCreate(
  deps: RuntimeDeps,
  input: {
    title: string;
    list_id: number;
    content?: string;
    tags?: string[];
    priority?: "high" | "medium" | "low" | "none";
    due_at?: string | null;
    sort_order?: number;
  },
) {
  assertPg(deps);
  const item = await createTaskItem(input);
  return { item };
}

export async function serviceTaskPatch(
  deps: RuntimeDeps,
  input: {
    id: number;
    title?: string;
    list_id?: number;
    content?: string;
    tags?: string[];
    priority?: "high" | "medium" | "low" | "none";
    due_at?: string | null;
    sort_order?: number;
    status?: "pending" | "completed";
  },
) {
  assertPg(deps);
  const { id, ...patch } = input;
  const item = await updateTaskItem({ id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskComplete(deps: RuntimeDeps, id: number) {
  assertPg(deps);
  const item = await completeTaskItem(id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskUncomplete(deps: RuntimeDeps, id: number) {
  assertPg(deps);
  const item = await uncompleteTaskItem(id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskDelete(deps: RuntimeDeps, id: number) {
  assertPg(deps);
  const ok = await deleteTaskItem(id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}
