import { omitUndefined } from "@freeanima/habitat/core/util";
import { TaskContainer } from "@freeanima/shared/pg-shapes/entity/enums.ts";
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
  getTaskItem,
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
import { convertTaskItemToCalendarEvent } from "@freeanima/features/calendar/domain/convert-task-event.ts";
import type { TaskItemSearchFilters } from "@freeanima/habitat/core/db/schema";
import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectIdAllowed(auth: RpcRequestAuthContext, subjectId: number): void {
  if (auth.subject_id === subjectId) return;
  if (auth.subject_type === "user") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function requireSubjectId(subject_id: number | undefined): number {
  if (subject_id == null || !Number.isInteger(subject_id) || subject_id <= 0) {
    throw new Error("subject_id is required");
  }
  return subject_id;
}

async function taskWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_id: number | undefined,
): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return resolvePrivateWorldId(subjectId);
}

export async function serviceTasklistList(
  deps: RuntimeDeps,
  input: { subject_id?: number; include_closed?: boolean } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input?.subject_id);
  await ensureDefaultTaskListForWorld(worldId);
  const lists = await listTaskLists(
    worldId,
    omitUndefined({ includeClosed: input?.include_closed }),
  );
  return { lists };
}

export async function serviceTasklistStats(
  deps: RuntimeDeps,
  input: { subject_id?: number; include_closed?: boolean } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input?.subject_id);
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
    subject_id?: number;
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
  const { subject_id, ...createInput } = input;
  const item = await createTaskList(await taskWorldIdForAuth(auth, subject_id), createInput);
  return { item };
}

export async function serviceTasklistPatch(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
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
  const { id, subject_id, ...patch } = input;
  const item = await updateTaskList(await taskWorldIdForAuth(auth, subject_id), { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTasklistDelete(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number; cascade?: boolean },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  try {
    const ok = await deleteTaskList(await taskWorldIdForAuth(auth, input.subject_id), input.id, {
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
  input: { subject_id?: number } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input?.subject_id);
  await ensureDefaultTaskListForWorld(worldId);
  const smart_lists = await listSmartListsMerged(worldId);
  return { smart_lists };
}

export async function serviceSmartlistStats(
  deps: RuntimeDeps,
  input: { subject_id?: number } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input?.subject_id);
  await ensureDefaultTaskListForWorld(worldId);
  const counts = await listSmartListStats(worldId);
  return { counts };
}

export async function serviceSmartlistCreate(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    title: string;
    filters: TaskItemSearchFilters;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_id, ...createInput } = input;
  const item = await createSmartList(await taskWorldIdForAuth(auth, subject_id), createInput);
  return { item };
}

export async function serviceSmartlistPatch(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    id: number;
    title?: string;
    filters?: TaskItemSearchFilters;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_id, ...patch } = input;
  const item = await updateSmartList(await taskWorldIdForAuth(auth, subject_id), {
    id,
    ...patch,
  });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceSmartlistDelete(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteSmartList(await taskWorldIdForAuth(auth, input.subject_id), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

/** 清单模块列任务（清单侧）；不含项目内任务（显式 TaskContainer.LIST） */
export async function serviceTasklistItemList(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
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
  const worldId = await taskWorldIdForAuth(auth, input.subject_id);
  await ensureDefaultTaskListForWorld(worldId);
  let filters = input.filters;
  if (
    filters != null &&
    filters.project_id == null &&
    filters.container == null &&
    filters.in_backlog == null
  ) {
    filters = { ...filters, container: TaskContainer.LIST };
  }
  if (filters != null && shouldListCompletedActivity(filters)) {
    const items = await listCompletedActivity(
      worldId,
      filters,
      omitUndefined({ limit: input.limit, offset: input.offset }),
    );
    return { items };
  }
  const items = await listTaskItems(
    worldId,
    omitUndefined({
      list_id: input.list_id,
      filters,
      status: filters == null ? (input.status ?? "all") : undefined,
      due_today: filters == null ? input.due_today : undefined,
      tag_ids: filters == null ? input.tag_ids : undefined,
      // 无 filters 时（按 list_id / status）仍限定清单侧
      container: filters == null ? TaskContainer.LIST : undefined,
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
    subject_id?: number;
    project_id: number;
    status?: "pending" | "completed" | "all";
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input.subject_id);
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
    subject_id?: number;
    title: string;
    list_id?: number;
    content?: string;
    tag_ids?: number[];
    priority?: "high" | "medium" | "low" | "none";
    start_at?: string | null;
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
  const { subject_id, list_id, ...rest } = input;
  const worldId = await taskWorldIdForAuth(auth, subject_id);
  const resolvedListId = list_id ?? (await getDefaultTaskList(worldId)).id;
  const item = await createTaskItem(worldId, omitUndefined({ ...rest, list_id: resolvedListId }));
  return { item };
}

/** 项目模块建任务 */
export async function serviceProjectItemCreate(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    title: string;
    project_id: number;
    content?: string;
    tag_ids?: number[];
    priority?: "high" | "medium" | "low" | "none";
    start_at?: string | null;
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
  const { subject_id, ...createInput } = input;
  const item = await createTaskItem(
    await taskWorldIdForAuth(auth, subject_id),
    omitUndefined(createInput),
  );
  return { item };
}

/** 按 id 取单条（含项目内任务） */
export async function serviceTaskGet(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    id: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await getTaskItem(await taskWorldIdForAuth(auth, input.subject_id), input.id);
  return { item };
}

/** 共享内容字段 patch；归属请用 moveToProject / moveToList */
export async function serviceTaskPatch(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    id: number;
    title?: string;
    content?: string;
    tag_ids?: number[];
    priority?: "high" | "medium" | "low" | "none";
    start_at?: string | null;
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
  const { id, subject_id, ...patch } = input;
  const item = await updateTaskItem(
    await taskWorldIdForAuth(auth, subject_id),
    omitUndefined({ id, ...patch }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskMoveToProject(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    id: number;
    project_id: number;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_id, project_id, sort_order } = input;
  const item = await updateTaskItem(
    await taskWorldIdForAuth(auth, subject_id),
    omitUndefined({ id, project_id, sort_order }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskMoveToList(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    id: number;
    list_id: number;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_id, list_id, sort_order } = input;
  const item = await updateTaskItem(
    await taskWorldIdForAuth(auth, subject_id),
    omitUndefined({ id, list_id, sort_order }),
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskComplete(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await completeTaskItem(await taskWorldIdForAuth(auth, input.subject_id), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskSkip(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await skipTaskItem(await taskWorldIdForAuth(auth, input.subject_id), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskCompleteForever(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await completeTaskItemForever(
    await taskWorldIdForAuth(auth, input.subject_id),
    input.id,
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskListOccurrences(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    series_task_id: number;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const items = await listTaskOccurrences(
    await taskWorldIdForAuth(auth, input.subject_id),
    input.series_task_id,
    omitUndefined({ limit: input.limit, offset: input.offset }),
  );
  return { items };
}

export async function serviceTaskUncomplete(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await uncompleteTaskItem(await taskWorldIdForAuth(auth, input.subject_id), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskDelete(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteTaskItem(await taskWorldIdForAuth(auth, input.subject_id), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceTaskConvertToEvent(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await convertTaskItemToCalendarEvent(
    await taskWorldIdForAuth(auth, input.subject_id),
    input.id,
  );
  return { item };
}

export async function serviceTaskSearch(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    query: string;
    list_id?: number;
    status?: "pending" | "completed" | "all";
    limit?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...searchInput } = input;
  const items = await searchTaskItems(worldId, omitUndefined(searchInput));
  return { items };
}

export async function serviceTaskImportDidaCsv(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    csv_text: string;
    mode?: "upsert" | "create_only";
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { applyDidaCsvImport } = await import("../domain/apply-dida-import.ts");
  const worldId = await taskWorldIdForAuth(auth, input.subject_id);
  return applyDidaCsvImport(worldId, input.csv_text, input.mode ?? "upsert");
}
