import { omitUndefined } from "@freeanima/core/util";
import {
  completeTaskItem,
  createTaskItem,
  createTaskList,
  createSmartList,
  deleteTaskItem,
  deleteTaskList,
  deleteSmartList,
  ensureDefaultTaskListForWorld,
  listSmartListsMerged,
  listTaskItems,
  listTaskLists,
  searchTaskItems,
  uncompleteTaskItem,
  updateTaskItem,
  updateTaskList,
  updateSmartList,
} from "../domain/index.ts";
import type { TaskItemSearchFilters } from "@freeanima/core/db/schema";
import type { SubjectKind } from "@freeanima/core/config";
import { resolveSubjectWorldId } from "@freeanima/core/config/world-context";
import type { VerifiedServiceApiToken } from "@freeanima/core/db/pg/service-api-token";
import type { SapRequestAuthContext } from "@freeanima/shared/sap-contract";

import { isPostgresPrimary } from "@freeanima/core/db/pg";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectKindMatches(auth: SapRequestAuthContext, subject_kind?: SubjectKind): void {
  if (!subject_kind || subject_kind === auth.subject_type) return;
  if (auth.subject_type === "user" && subject_kind === "agent") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function resolveSubjectKind(subject_kind?: SubjectKind): SubjectKind {
  return subject_kind ?? "user";
}

async function taskWorldIdForAuth(
  auth: SapRequestAuthContext,
  subject_kind?: SubjectKind,
): Promise<number> {
  const kind = resolveSubjectKind(subject_kind);
  assertSubjectKindMatches(auth, kind);
  return resolveSubjectWorldId(kind);
}

export async function serviceTasklistList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; include_closed?: boolean } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input?.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  const lists = await listTaskLists(
    worldId,
    omitUndefined({ includeClosed: input?.include_closed }),
  );
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
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createTaskList(await taskWorldIdForAuth(auth, subject_kind), createInput);
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
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateTaskList(await taskWorldIdForAuth(auth, subject_kind), { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTasklistDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number; cascade?: boolean },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  try {
    const ok = await deleteTaskList(await taskWorldIdForAuth(auth, input.subject_kind), input.id, {
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

export async function serviceSmartlistList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input?.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  const smart_lists = await listSmartListsMerged(worldId);
  return { smart_lists };
}

export async function serviceSmartlistCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    title: string;
    filters: TaskItemSearchFilters;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createSmartList(await taskWorldIdForAuth(auth, subject_kind), createInput);
  return { item };
}

export async function serviceSmartlistPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    title?: string;
    filters?: TaskItemSearchFilters;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateSmartList(await taskWorldIdForAuth(auth, subject_kind), {
    id,
    ...patch,
  });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceSmartlistDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteSmartList(await taskWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceTaskList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    list_id?: number;
    project_id?: number;
    filters?: TaskItemSearchFilters;
    status?: "pending" | "completed" | "all";
    due_today?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  if (input.list_id != null && input.filters != null) {
    throw new Error("list_id and filters are mutually exclusive");
  }
  if (input.project_id != null && input.list_id != null) {
    throw new Error("project_id and list_id are mutually exclusive");
  }
  const worldId = await taskWorldIdForAuth(auth, input.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  const items = await listTaskItems(
    worldId,
    omitUndefined({
      list_id: input.list_id,
      project_id: input.project_id,
      filters: input.filters,
      status: input.filters == null ? (input.status ?? "all") : undefined,
      due_today: input.filters == null ? input.due_today : undefined,
      tags: input.filters == null ? input.tags : undefined,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items };
}

export async function serviceTaskCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    title: string;
    list_id: number;
    project_id?: number;
    milestone_id?: number;
    content?: string;
    tags?: string[];
    priority?: "high" | "medium" | "low" | "none";
    due_at?: string | null;
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createTaskItem(await taskWorldIdForAuth(auth, subject_kind), createInput);
  return { item };
}

export async function serviceTaskPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    title?: string;
    list_id?: number;
    project_id?: number | null;
    milestone_id?: number | null;
    content?: string;
    tags?: string[];
    priority?: "high" | "medium" | "low" | "none";
    due_at?: string | null;
    sort_order?: number;
    status?: "pending" | "completed";
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateTaskItem(await taskWorldIdForAuth(auth, subject_kind), { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskComplete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await completeTaskItem(await taskWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskUncomplete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await uncompleteTaskItem(
    await taskWorldIdForAuth(auth, input.subject_kind),
    input.id,
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteTaskItem(await taskWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceTaskSearch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    query: string;
    list_id?: number;
    status?: "pending" | "completed" | "all";
    limit?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input.subject_kind);
  const { subject_kind: _kind, ...searchInput } = input;
  const items = await searchTaskItems(worldId, omitUndefined(searchInput));
  return { items };
}
