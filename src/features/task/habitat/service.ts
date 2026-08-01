import { omitUndefined } from "@freeanima/host/core/util";
import {
  completeTaskItem,
  completeTaskItemForever,
  createTaskItem,
  createTaskList,
  createSmartList,
  deleteTaskItem,
  deleteTaskList,
  deleteSmartList,
  ensureDefaultTaskListForWorld,
  getDefaultTaskList,
  listCompletedActivity,
  listSmartListsMerged,
  countSubtasks,
  listTaskItems,
  listTaskLists,
  listTaskListStats,
  listSmartListStats,
  listTaskOccurrences,
  searchTaskItems,
  shouldListCompletedActivity,
  skipTaskItem,
  uncompleteTaskItem,
  updateTaskItem,
  updateTaskList,
  updateSmartList,
} from "../domain/index.ts";
import type { TaskItemSearchFilters } from "@freeanima/host/core/db/schema";
import type { SubjectKind } from "@freeanima/host/core/config";
import { resolveSubjectWorldId } from "@freeanima/host/core/config/world-context";
import type { VerifiedServiceApiToken } from "@freeanima/host/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectKindMatches(auth: RpcRequestAuthContext, subject_kind?: SubjectKind): void {
  if (!subject_kind || subject_kind === auth.subject_type) return;
  if (auth.subject_type === "user" && subject_kind === "agent") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function resolveSubjectKind(subject_kind: SubjectKind | undefined): SubjectKind {
  if (subject_kind !== "user" && subject_kind !== "agent") {
    throw new Error("subject_kind is required (user|agent)");
  }
  return subject_kind;
}

async function taskWorldIdForAuth(
  auth: RpcRequestAuthContext,
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

export async function serviceTasklistStats(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; include_closed?: boolean } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input?.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  const counts = await listTaskListStats(
    worldId,
    omitUndefined({ includeClosed: input?.include_closed }),
  );
  return { counts };
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

export async function serviceSmartlistStats(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input?.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  const counts = await listSmartListStats(worldId);
  return { counts };
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

/** 任务模块列任务（Backlog / 清单）；不含项目内任务（默认 in_backlog） */
export async function serviceTasklistItemList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    list_id?: number;
    filters?: TaskItemSearchFilters;
    status?: "pending" | "completed" | "all";
    due_today?: boolean;
    tag_ids?: number[];
    roots_only?: boolean;
    parent_id?: number;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  if (input.list_id != null && input.filters != null) {
    throw new Error("list_id and filters are mutually exclusive");
  }
  const worldId = await taskWorldIdForAuth(auth, input.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  if (input.filters != null && shouldListCompletedActivity(input.filters)) {
    const items = await listCompletedActivity(
      worldId,
      input.filters,
      omitUndefined({ limit: input.limit, offset: input.offset }),
    );
    return { items };
  }
  const items = await listTaskItems(
    worldId,
    omitUndefined({
      list_id: input.list_id,
      filters: input.filters,
      status: input.filters == null ? (input.status ?? "all") : undefined,
      due_today: input.filters == null ? input.due_today : undefined,
      tag_ids: input.filters == null ? input.tag_ids : undefined,
      roots_only: input.parent_id != null ? false : (input.roots_only ?? true),
      parent_id: input.parent_id,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  // 根任务附带子任务进度
  if (input.parent_id == null && (input.roots_only ?? true)) {
    const enriched = await Promise.all(
      items.map(async (item) => {
        const { done, total } = await countSubtasks(worldId, item.id);
        if (total === 0) return item;
        return { ...item, subtask_done: done, subtask_total: total };
      }),
    );
    return { items: enriched };
  }
  return { items };
}

/** 项目模块列任务 */
export async function serviceProjectItemList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    project_id: number;
    status?: "pending" | "completed" | "all";
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input.subject_kind);
  const items = await listTaskItems(
    worldId,
    omitUndefined({
      project_id: input.project_id,
      status: input.status ?? "all",
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items };
}

/** 任务模块建任务；省略 list_id 时落到默认收件箱 */
export async function serviceTasklistItemCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    title: string;
    list_id?: number;
    content?: string;
    tag_ids?: number[];
    priority?: "high" | "medium" | "low" | "none";
    due_at?: string | null;
    remind_at?: string | null;
    reminders?: Parameters<typeof createTaskItem>[1]["reminders"];
    parent_id?: number | null;
    recurrence?: Parameters<typeof createTaskItem>[1]["recurrence"];
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, list_id, ...rest } = input;
  const worldId = await taskWorldIdForAuth(auth, subject_kind);
  const resolvedListId = list_id ?? (await getDefaultTaskList(worldId)).id;
  const item = await createTaskItem(worldId, omitUndefined({ ...rest, list_id: resolvedListId }));
  return { item };
}

/** 项目模块建任务 */
export async function serviceProjectItemCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    title: string;
    project_id: number;
    content?: string;
    tag_ids?: number[];
    priority?: "high" | "medium" | "low" | "none";
    due_at?: string | null;
    remind_at?: string | null;
    reminders?: Parameters<typeof createTaskItem>[1]["reminders"];
    parent_id?: number | null;
    recurrence?: Parameters<typeof createTaskItem>[1]["recurrence"];
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createTaskItem(
    await taskWorldIdForAuth(auth, subject_kind),
    omitUndefined(createInput),
  );
  return { item };
}

/** 共享内容字段 patch；归属请用 moveToProject / moveToList */
export async function serviceTaskPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    title?: string;
    content?: string;
    tag_ids?: number[];
    priority?: "high" | "medium" | "low" | "none";
    due_at?: string | null;
    remind_at?: string | null;
    reminders?: Parameters<typeof updateTaskItem>[1]["reminders"];
    parent_id?: number | null;
    sort_order?: number;
    status?: "pending" | "completed";
    recurrence?: Parameters<typeof updateTaskItem>[1]["recurrence"];
    only_this?: boolean;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateTaskItem(
    await taskWorldIdForAuth(auth, subject_kind),
    omitUndefined({ id, ...patch }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskMoveToProject(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    project_id: number;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, project_id, sort_order } = input;
  const item = await updateTaskItem(
    await taskWorldIdForAuth(auth, subject_kind),
    omitUndefined({ id, project_id, sort_order }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskMoveToList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    list_id: number;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, list_id, sort_order } = input;
  const item = await updateTaskItem(
    await taskWorldIdForAuth(auth, subject_kind),
    omitUndefined({ id, list_id, sort_order }),
  );
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

export async function serviceTaskSkip(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await skipTaskItem(await taskWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskCompleteForever(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await completeTaskItemForever(
    await taskWorldIdForAuth(auth, input.subject_kind),
    input.id,
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskListOccurrences(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    series_task_id: number;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const items = await listTaskOccurrences(
    await taskWorldIdForAuth(auth, input.subject_kind),
    input.series_task_id,
    omitUndefined({ limit: input.limit, offset: input.offset }),
  );
  return { items };
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
