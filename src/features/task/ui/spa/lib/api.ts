import { getSubjectKind } from "@freeanima/frontend/shell-sdk";
import { resolveHabitatCacheScope } from "@freeanima/frontend/shell-sdk/offline-cache";
import { isHabitatFetchAvailable } from "@freeanima/frontend/shell-sdk/habitat-fetch-gate";
import { isTempId } from "@freeanima/frontend/shell-sdk/offline-temp-id";

import type {
  SmartListRowPayload,
  TaskItemRowPayload,
  TaskItemSearchFiltersPayload,
} from "@freeanima/shared/sap-contract/frames/task.ts";

import { getTypedSatelliteHabitatClient } from "@freeanima/platform/habitat/client.ts";

import {
  offlineCreateTaskItem,
  offlineCreateTaskList,
  offlineDeleteTaskItem,
  offlineDeleteTaskList,
  offlineUpdateTaskItem,
  offlineUpdateTaskList,
  reconcileServerTaskItems,
  reconcileServerTaskLists,
  registerTaskOfflineModule,
  seedLocalTaskItems,
  type OfflineUpdateTaskItemOpts,
} from "./offline-store.ts";
import {
  readCachedTaskItems,
  readCachedTaskLists,
  writeCachedTaskItems,
  writeCachedTaskLists,
} from "./offline-cache.ts";
import { normalizeTaskItemRows } from "./normalize-task-item.ts";

export { seedLocalTaskItems };

let taskModuleRegistered = false;

function ensureTaskOfflineModule(): void {
  if (taskModuleRegistered) return;
  registerTaskOfflineModule();
  taskModuleRegistered = true;
}

export type TaskItemSearchFilters = TaskItemSearchFiltersPayload;
export type SmartListRow = SmartListRowPayload;

export type TaskListRow = {
  id: number;
  name: string;
  sort_order: number;
  closed: boolean;
  color: string | null;
  is_default: boolean;
  is_folder: boolean;
  parent_id: number | null;
  item_count: number;
  created_at: string;
  updated_at: string;
};

export type TaskItemRow = TaskItemRowPayload;

function habitat() {
  return getTypedSatelliteHabitatClient();
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

export async function fetchTaskLists(opts?: { includeClosed?: boolean }): Promise<TaskListRow[]> {
  const scope = resolveHabitatCacheScope();
  if (!isHabitatFetchAvailable()) {
    return (await readCachedTaskLists(scope)) ?? [];
  }
  try {
    const data = await habitat().call(
      "tasklist.list",
      withSubjectKind({ include_closed: opts?.includeClosed }),
    );
    const merged = await reconcileServerTaskLists(data.lists);
    void writeCachedTaskLists(scope, merged);
    return merged;
  } catch {
    return (await readCachedTaskLists(scope)) ?? [];
  }
}

export async function fetchTaskListStats(opts?: {
  includeClosed?: boolean;
}): Promise<Map<number, number>> {
  if (!isHabitatFetchAvailable()) return new Map();
  const data = await habitat().call(
    "tasklist.stats",
    withSubjectKind({ include_closed: opts?.includeClosed }),
  );
  return new Map(data.counts.map((row) => [row.id, row.item_count]));
}

export async function fetchSmartListStats(): Promise<Map<string, number>> {
  if (!isHabitatFetchAvailable()) return new Map();
  const data = await habitat().call("smartlist.stats", withSubjectKind({}));
  const map = new Map<string, number>();
  for (const row of data.counts) {
    if (row.preset != null) map.set(row.preset, row.item_count);
    else if (row.id != null) map.set(`id:${row.id}`, row.item_count);
  }
  return map;
}

export async function createTaskList(input: {
  name: string;
  is_folder?: boolean;
  parent_id?: number | null;
  sort_order?: number;
  color?: string | null;
}): Promise<TaskListRow> {
  ensureTaskOfflineModule();
  return offlineCreateTaskList(input);
}

export async function updateTaskList(
  id: number,
  patch: Partial<
    Pick<TaskListRow, "name" | "sort_order" | "closed" | "color" | "is_folder" | "parent_id">
  >,
): Promise<TaskListRow> {
  ensureTaskOfflineModule();
  return offlineUpdateTaskList(id, patch);
}

export async function closeTaskList(id: number): Promise<TaskListRow> {
  return updateTaskList(id, { closed: true });
}

export async function reopenTaskList(id: number): Promise<TaskListRow> {
  return updateTaskList(id, { closed: false });
}

export async function deleteTaskList(id: number): Promise<void> {
  ensureTaskOfflineModule();
  return offlineDeleteTaskList(id);
}

export async function fetchTaskItems(listId: number): Promise<TaskItemRow[]> {
  const scope = resolveHabitatCacheScope();
  if (isTempId(listId) || !isHabitatFetchAvailable()) {
    return normalizeTaskItemRows(await readCachedTaskItems(scope, listId));
  }
  try {
    const data = await habitat().call(
      "tasklist.item.list",
      withSubjectKind({ list_id: listId, status: "all" }),
    );
    const items = normalizeTaskItemRows(data.items);
    const merged = await reconcileServerTaskItems(listId, items);
    void writeCachedTaskItems(scope, listId, merged);
    return merged;
  } catch {
    return normalizeTaskItemRows(await readCachedTaskItems(scope, listId));
  }
}

export async function fetchTaskItemsByFilters(
  filters: TaskItemSearchFilters,
): Promise<TaskItemRow[]> {
  if (!isHabitatFetchAvailable()) return [];
  const data = await habitat().call("tasklist.item.list", withSubjectKind({ filters }));
  const items = normalizeTaskItemRows(data.items);
  void seedLocalTaskItems(items);
  return items;
}

/** Resolve a single task by id (best-effort list scan; used by Anima URI overlay). */
export async function fetchTaskItemById(id: number): Promise<TaskItemRow | null> {
  if (!isHabitatFetchAvailable()) return null;
  const data = await habitat().call(
    "tasklist.item.list",
    withSubjectKind({ status: "all", limit: 200 }),
  );
  const items = normalizeTaskItemRows(data.items);
  void seedLocalTaskItems(items);
  const row = items.find((item) => item.id === id);
  return row ?? null;
}

export async function fetchSmartLists(): Promise<SmartListRow[]> {
  if (!isHabitatFetchAvailable()) return [];
  const data = await habitat().call("smartlist.list", withSubjectKind({}));
  return data.smart_lists;
}

export async function createSmartList(input: {
  title: string;
  filters: TaskItemSearchFilters;
  sort_order?: number;
}): Promise<SmartListRow> {
  const data = await habitat().call("smartlist.create", withSubjectKind(input));
  return data.item;
}

export async function updateSmartList(
  id: number,
  patch: { title?: string; filters?: TaskItemSearchFilters; sort_order?: number },
): Promise<SmartListRow> {
  const data = await habitat().call("smartlist.patch", withSubjectKind({ id, ...patch }));
  return data.item;
}

export async function deleteSmartList(id: number): Promise<void> {
  await habitat().call("smartlist.delete", withSubjectKind({ id }));
}

export async function searchTaskItems(input: {
  query: string;
  /** 限定单个清单；省略则搜索全部清单 */
  list_id?: number;
  status?: "pending" | "completed" | "all";
  limit?: number;
}): Promise<TaskItemRow[]> {
  const data = await habitat().call(
    "task.search",
    withSubjectKind({
      query: input.query,
      list_id: input.list_id,
      status: input.status,
      limit: input.limit,
    }),
  );
  return normalizeTaskItemRows(data.items);
}

export async function createTaskItem(input: {
  title: string;
  list_id: number;
  content?: string;
  tag_ids?: number[];
  priority?: TaskItemRow["priority"];
  due_at?: string | null;
  sort_order?: number;
}): Promise<TaskItemRow> {
  ensureTaskOfflineModule();
  return offlineCreateTaskItem(input);
}

export async function updateTaskItem(
  id: number,
  patch: Partial<
    Pick<
      TaskItemRow,
      "title" | "content" | "tag_ids" | "priority" | "due_at" | "status" | "sort_order"
    >
  >,
  opts?: OfflineUpdateTaskItemOpts,
): Promise<TaskItemRow> {
  ensureTaskOfflineModule();
  return offlineUpdateTaskItem(id, patch, opts);
}

export async function moveTaskItemToList(
  id: number,
  listId: number,
  sortOrder?: number,
): Promise<TaskItemRow> {
  ensureTaskOfflineModule();
  return offlineUpdateTaskItem(id, {
    list_id: listId,
    ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
  });
}

export async function moveTaskItemToProject(
  id: number,
  projectId: number,
  sortOrder?: number,
): Promise<TaskItemRow> {
  ensureTaskOfflineModule();
  return offlineUpdateTaskItem(id, {
    project_id: projectId,
    ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
  });
}

export type ProjectPickerRow = { id: number; title: string; status: string };

export async function fetchProjectsForMove(): Promise<ProjectPickerRow[]> {
  const data = await habitat().call("project.list", withSubjectKind({}));
  return data.projects.map((p) => ({ id: p.id, title: p.title, status: p.status }));
}

export async function completeTaskItem(id: number): Promise<TaskItemRow> {
  ensureTaskOfflineModule();
  return offlineUpdateTaskItem(id, { status: "completed" });
}

export async function uncompleteTaskItem(id: number): Promise<TaskItemRow> {
  ensureTaskOfflineModule();
  return offlineUpdateTaskItem(id, { status: "pending" });
}

export async function deleteTaskItem(id: number): Promise<void> {
  ensureTaskOfflineModule();
  return offlineDeleteTaskItem(id);
}

export { countTaskPendingOps } from "./offline-store.ts";
