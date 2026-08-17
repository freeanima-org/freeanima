import { getSubjectKind } from "@freeanima/client/portal-sdk";
import { resolveHabitatCacheScope } from "@freeanima/client/portal-sdk/offline-cache";
import { withOfflineCache } from "@freeanima/client/portal-sdk/offline-cache-first";
import { isHabitatFetchAvailable } from "@freeanima/client/portal-sdk/habitat-fetch-gate";
import { isTempId } from "@freeanima/client/portal-sdk/offline-temp-id";

import type {
  SmartListRowPayload,
  TaskItemRowPayload,
  TaskItemSearchFiltersPayload,
} from "@freeanima/shared/rpc-contract/frames/task.ts";

import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

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
import { readCachedTaskItems, readCachedTaskLists } from "./offline-cache.ts";
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
  return getTypedHabitatClient();
}

function withSubjectKind<T extends Record<string, unknown>>(payload: T) {
  return { subject_kind: getSubjectKind(), ...payload };
}

export async function fetchTaskLists(opts?: { includeClosed?: boolean }): Promise<TaskListRow[]> {
  const scope = resolveHabitatCacheScope();
  try {
    return await withOfflineCache({
      scope,
      namespace: "tasks",
      id: "lists",
      fetch: async () => {
        const data = await habitat().call(
          "tasklist.list",
          withSubjectKind({ include_closed: opts?.includeClosed }),
        );
        return reconcileServerTaskLists(data.lists);
      },
      offlineError: "tasklist.list unavailable offline",
    });
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
  if (isTempId(listId)) {
    return normalizeTaskItemRows(await readCachedTaskItems(scope, listId));
  }
  try {
    return await withOfflineCache({
      scope,
      namespace: "tasks",
      id: `items:${String(listId)}`,
      fetch: async () => {
        const data = await habitat().call(
          "tasklist.item.list",
          withSubjectKind({ list_id: listId, status: "all" }),
        );
        const items = normalizeTaskItemRows(data.items);
        return reconcileServerTaskItems(listId, items);
      },
      offlineError: "tasklist.item.list unavailable offline",
    });
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

/** 列子任务（一层） */
export async function fetchSubtasks(parentId: number): Promise<TaskItemRow[]> {
  if (!isHabitatFetchAvailable()) return [];
  const data = await habitat().call(
    "tasklist.item.list",
    withSubjectKind({ parent_id: parentId, roots_only: false, status: "all" }),
  );
  return normalizeTaskItemRows(data.items);
}

/** 按 id 取单条任务（含项目内；供 entity overlay / 日历入口）。 */
export async function fetchTaskItemById(id: number): Promise<TaskItemRow | null> {
  if (!isHabitatFetchAvailable()) return null;
  const data = await habitat().call("task.get", withSubjectKind({ id }));
  if (!data.item) return null;
  const [row] = normalizeTaskItemRows([data.item]);
  if (row) void seedLocalTaskItems([row]);
  return row ?? null;
}

export async function fetchSmartLists(): Promise<SmartListRow[]> {
  if (!isHabitatFetchAvailable()) {
    return [];
  }
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
  remind_at?: string | null;
  parent_id?: number | null;
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
      | "tag_ids"
      | "priority"
      | "start_at"
      | "end_at"
      | "due_at"
      | "remind_at"
      | "reminders"
      | "parent_id"
      | "status"
      | "sort_order"
      | "recurrence"
    >
  > & { only_this?: boolean },
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

/** 同 id 有损转为日历事件（需联网） */
export async function convertTaskItemToEvent(id: number): Promise<{ id: number; title: string }> {
  const data = await habitat().call("task.convertToEvent", {
    subject_kind: "user",
    id,
  });
  return { id: data.item.id, title: data.item.title };
}

export type TaskAdvanceReminderEvent = {
  task_item_id: number;
  title: string;
  body: string;
  at: string;
  source_ref: string;
};

/** 提前提醒推送（本机 Alert；不写 Inbox） */
export function subscribeTaskAdvanceReminders(onEvent: (event: TaskAdvanceReminderEvent) => void): {
  unsubscribe: () => void;
} {
  return habitat().subscribe(
    "task.subscribeAdvanceReminders",
    {},
    {
      onData: (payload) => {
        const record = payload as Partial<TaskAdvanceReminderEvent>;
        if (
          typeof record.task_item_id === "number" &&
          typeof record.title === "string" &&
          typeof record.body === "string" &&
          typeof record.at === "string" &&
          typeof record.source_ref === "string"
        ) {
          onEvent({
            task_item_id: record.task_item_id,
            title: record.title,
            body: record.body,
            at: record.at,
            source_ref: record.source_ref,
          });
        }
      },
    },
  );
}

export { countTaskPendingOps } from "./offline-store.ts";
