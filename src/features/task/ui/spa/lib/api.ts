import { getSubjectKind } from "@freeanima/frontend/shell-sdk";
import { resolveHubCacheScope } from "@freeanima/frontend/shell-sdk/offline-cache";
import { isHubFetchAvailable } from "@freeanima/frontend/shell-sdk/hub-fetch-gate";
import { isTempId } from "@freeanima/frontend/shell-sdk/offline-temp-id";

import type {
  SmartListRowPayload,
  TaskItemRowPayload,
  TaskItemSearchFiltersPayload,
} from "@freeanima/shared/sap-contract/frames/task.ts";

import { getTypedSatelliteHubClient } from "@freeanima/platform/hub/client.ts";

import {
  offlineCreateTaskItem,
  offlineCreateTaskList,
  offlineDeleteTaskItem,
  offlineDeleteTaskList,
  offlineUpdateTaskItem,
  offlineUpdateTaskList,
  registerTaskOfflineModule,
} from "./offline-store.ts";
import { readCachedTaskItems, readCachedTaskLists } from "./offline-cache.ts";

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

function normalizeTaskListRow(list: {
  id: number;
  name: string;
  sort_order: number;
  closed: boolean;
  color: string | null;
  is_default: boolean;
  is_folder: boolean;
  parent_id: number | null;
  item_count?: number | undefined;
  created_at: string;
  updated_at: string;
}): TaskListRow {
  return {
    id: list.id,
    name: list.name,
    sort_order: list.sort_order,
    closed: list.closed,
    color: list.color,
    is_default: list.is_default,
    is_folder: list.is_folder,
    parent_id: list.parent_id,
    item_count: list.item_count ?? 0,
    created_at: list.created_at,
    updated_at: list.updated_at,
  };
}

function hub() {
  return getTypedSatelliteHubClient();
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

export async function fetchTaskLists(opts?: { includeClosed?: boolean }): Promise<TaskListRow[]> {
  if (!isHubFetchAvailable()) {
    return (await readCachedTaskLists(resolveHubCacheScope())) ?? [];
  }
  const data = await hub().call(
    "tasklist.list",
    withSubjectKind({ include_closed: opts?.includeClosed }),
  );
  return data.lists.map(normalizeTaskListRow);
}

export async function fetchTaskListStats(opts?: {
  includeClosed?: boolean;
}): Promise<Map<number, number>> {
  if (!isHubFetchAvailable()) return new Map();
  const data = await hub().call(
    "tasklist.stats",
    withSubjectKind({ include_closed: opts?.includeClosed }),
  );
  return new Map(data.counts.map((row) => [row.id, row.item_count]));
}

export async function fetchSmartListStats(): Promise<Map<string, number>> {
  if (!isHubFetchAvailable()) return new Map();
  const data = await hub().call("smartlist.stats", withSubjectKind({}));
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
  if (isTempId(listId) || !isHubFetchAvailable()) {
    return (await readCachedTaskItems(resolveHubCacheScope(), listId)) ?? [];
  }
  const data = await hub().call(
    "tasklist.item.list",
    withSubjectKind({ list_id: listId, status: "all" }),
  );
  return data.items;
}

export async function fetchTaskItemsByFilters(
  filters: TaskItemSearchFilters,
): Promise<TaskItemRow[]> {
  if (!isHubFetchAvailable()) return [];
  const data = await hub().call("tasklist.item.list", withSubjectKind({ filters }));
  return data.items;
}

/** Resolve a single task by id (best-effort list scan; used by Anima URI overlay). */
export async function fetchTaskItemById(id: number): Promise<TaskItemRow | null> {
  if (!isHubFetchAvailable()) return null;
  const data = await hub().call(
    "tasklist.item.list",
    withSubjectKind({ status: "all", limit: 200 }),
  );
  return data.items.find((row) => row.id === id) ?? null;
}

export async function fetchSmartLists(): Promise<SmartListRow[]> {
  if (!isHubFetchAvailable()) return [];
  const data = await hub().call("smartlist.list", withSubjectKind({}));
  return data.smart_lists;
}

export async function createSmartList(input: {
  title: string;
  filters: TaskItemSearchFilters;
  sort_order?: number;
}): Promise<SmartListRow> {
  const data = await hub().call("smartlist.create", withSubjectKind(input));
  return data.item;
}

export async function updateSmartList(
  id: number,
  patch: { title?: string; filters?: TaskItemSearchFilters; sort_order?: number },
): Promise<SmartListRow> {
  const data = await hub().call("smartlist.patch", withSubjectKind({ id, ...patch }));
  return data.item;
}

export async function deleteSmartList(id: number): Promise<void> {
  await hub().call("smartlist.delete", withSubjectKind({ id }));
}

export async function searchTaskItems(input: {
  query: string;
  /** 限定单个清单；省略则搜索全部清单 */
  list_id?: number;
  status?: "pending" | "completed" | "all";
  limit?: number;
}): Promise<TaskItemRow[]> {
  const data = await hub().call(
    "task.search",
    withSubjectKind({
      query: input.query,
      list_id: input.list_id,
      status: input.status,
      limit: input.limit,
    }),
  );
  return data.items;
}

export async function createTaskItem(input: {
  title: string;
  list_id: number;
  content?: string;
  tags?: string[];
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
      | "title"
      | "content"
      | "tags"
      | "priority"
      | "due_at"
      | "milestone_id"
      | "status"
      | "sort_order"
    >
  >,
): Promise<TaskItemRow> {
  ensureTaskOfflineModule();
  return offlineUpdateTaskItem(id, patch);
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
  const data = await hub().call("project.list", withSubjectKind({}));
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
