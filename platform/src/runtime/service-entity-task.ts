import {
  completeTaskItem,
  createTaskItem,
  createTaskList,
  deleteTaskItem,
  deleteTaskList,
  ensureDefaultTaskListForWorld,
  listTaskItems,
  listTaskLists,
  uncompleteTaskItem,
  updateTaskItem,
  updateTaskList,
} from "@freeanima/capabilities-task";
import {
  getResolvedWorldContext,
  resolveSubjectWorldId,
  type SubjectKind,
} from "@freeanima/core/config";

import { isPostgresPrimary } from "@freeanima/core/db/pg";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function taskWorldId(kind: SubjectKind = "user"): number {
  return resolveSubjectWorldId(kind);
}

export async function serviceTasklistList(
  deps: RuntimeDeps,
  input?: { subject_kind?: SubjectKind; include_closed?: boolean },
) {
  assertPg(deps);
  const worldId = taskWorldId(input?.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  const lists = await listTaskLists(worldId, { includeClosed: input?.include_closed });
  return { lists };
}

export async function serviceTasklistCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    name: string;
    sort_order?: number;
    color?: string | null;
    is_folder?: boolean;
    parent_id?: number | null;
  },
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createTaskList(taskWorldId(subject_kind), createInput);
  return { item };
}

export async function serviceTasklistPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    name?: string;
    sort_order?: number;
    closed?: boolean;
    color?: string | null;
    is_folder?: boolean;
    parent_id?: number | null;
  },
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateTaskList(taskWorldId(subject_kind), { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTasklistDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number; cascade?: boolean },
) {
  assertPg(deps);
  try {
    const ok = await deleteTaskList(taskWorldId(input.subject_kind), input.id, {
      cascade: input.cascade ?? true,
    });
    if (!ok) throw new Error("NOT_FOUND");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("default task list")) {
      throw new Error("DEFAULT_LIST_CANNOT_DELETE", { cause: err });
    }
    throw err;
  }
}

export async function serviceTaskList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    list_id?: number;
    status?: "pending" | "completed" | "all";
    due_today?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const worldId = taskWorldId(input.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  const items = await listTaskItems(worldId, {
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
    subject_kind?: SubjectKind;
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
  const { subject_kind, ...createInput } = input;
  const item = await createTaskItem(taskWorldId(subject_kind), createInput);
  return { item };
}

export async function serviceTaskPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
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
  const { id, subject_kind, ...patch } = input;
  const item = await updateTaskItem(taskWorldId(subject_kind), { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskComplete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
) {
  assertPg(deps);
  const item = await completeTaskItem(taskWorldId(input.subject_kind), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskUncomplete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
) {
  assertPg(deps);
  const item = await uncompleteTaskItem(taskWorldId(input.subject_kind), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
) {
  assertPg(deps);
  const ok = await deleteTaskItem(taskWorldId(input.subject_kind), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export function serviceWorldsContext(_deps: RuntimeDeps) {
  return getResolvedWorldContext();
}
