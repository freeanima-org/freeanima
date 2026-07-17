import { getSubjectKind } from "@freeanima/frontend/shell-sdk";
import { getIdMapping, resolveIdFields } from "@freeanima/frontend/shell-sdk/offline-id-map";
import {
  registerOfflineModule,
  registerOfflineModuleCap,
} from "@freeanima/frontend/shell-sdk/offline-module-registry";
import type { RpcModuleAdapter } from "@freeanima/frontend/shell-sdk/offline-module-types";
import {
  enqueueOutboxOp,
  listOutboxOps,
  removeOutboxOp,
  resolveOutboxScope,
  type OfflineOutboxOp,
} from "@freeanima/frontend/shell-sdk/offline-outbox";
import {
  flushOfflineModule,
  recordFlushIdMapping,
} from "@freeanima/frontend/shell-sdk/offline-sync";
import {
  allocateTempId,
  isTempId,
  seedTempIdAllocatorFromIdMap,
} from "@freeanima/frontend/shell-sdk/offline-temp-id";
import { formatCstIso } from "@freeanima/core/util/time";
import { omitUndefined } from "@freeanima/core/util";
import type {
  TaskItemRowPayload,
  TaskListRowPayload,
} from "@freeanima/shared/sap-contract/frames/task.ts";
import { getTypedSatelliteHubClient } from "@freeanima/platform/hub/client.ts";
import { randomUuid } from "@freeanima/shared/sap-contract";

import {
  readCachedTaskItems,
  readCachedTaskLists,
  writeCachedTaskItems,
  writeCachedTaskLists,
} from "./offline-cache.ts";

const MODULE_ID = "task";

type TaskListRow = TaskListRowPayload;
type TaskItemRow = TaskItemRowPayload;

function subjectPayload(): { subject_kind: ReturnType<typeof getSubjectKind> } {
  return { subject_kind: getSubjectKind() };
}

async function readLocalLists(scope: string): Promise<TaskListRow[]> {
  return (await readCachedTaskLists(scope)) ?? [];
}

async function writeLocalLists(scope: string, lists: TaskListRow[]): Promise<void> {
  const sorted = lists.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  await writeCachedTaskLists(scope, sorted);
}

async function readLocalItems(scope: string, listId: number): Promise<TaskItemRow[]> {
  return (await readCachedTaskItems(scope, listId)) ?? [];
}

async function writeLocalItems(scope: string, listId: number, items: TaskItemRow[]): Promise<void> {
  const sorted = items.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  await writeCachedTaskItems(scope, listId, sorted);
}

async function upsertLocalList(scope: string, list: TaskListRow): Promise<void> {
  const lists = await readLocalLists(scope);
  const next = lists.filter((row) => row.id !== list.id);
  next.push(list);
  await writeLocalLists(scope, next);
}

async function removeLocalList(scope: string, id: number): Promise<void> {
  const lists = await readLocalLists(scope);
  await writeLocalLists(
    scope,
    lists.filter((row) => row.id !== id),
  );
  await writeCachedTaskItems(scope, id, []);
}

/** outbox 中仍存在 create op 的 temp 清单 id（尚未同步到服务器）。 */
async function pendingTempListIds(scope: string): Promise<Set<number>> {
  const ops = await listOutboxOps(scope, MODULE_ID);
  const ids = new Set<number>();
  for (const op of ops) {
    if (op.method === "tasklist.create" && typeof op.tempEntityId === "number") {
      ids.add(op.tempEntityId);
    }
  }
  return ids;
}

/** outbox 中仍存在 create op 的 temp 任务 id。 */
async function pendingTempItemIds(scope: string): Promise<Set<number>> {
  const ops = await listOutboxOps(scope, MODULE_ID);
  const ids = new Set<number>();
  for (const op of ops) {
    if (op.method === "tasklist.item.create" && typeof op.tempEntityId === "number") {
      ids.add(op.tempEntityId);
    }
  }
  return ids;
}

async function ensureAllocatorSeeded(scope: string): Promise<void> {
  await seedTempIdAllocatorFromIdMap(scope, MODULE_ID);
}

async function resolveEntityId(scope: string, id: number): Promise<number> {
  if (!isTempId(id)) return id;
  const mapped = await getIdMapping(scope, MODULE_ID, id);
  return mapped ?? id;
}

async function rewriteLocalListId(
  scope: string,
  tempId: number,
  serverId: number,
  serverRow?: TaskListRow,
): Promise<void> {
  const lists = await readLocalLists(scope);
  const existing = lists.find((row) => row.id === tempId);
  const rewritten: TaskListRow = serverRow
    ? { ...serverRow }
    : existing
      ? { ...existing, id: serverId }
      : {
          id: serverId,
          name: "",
          sort_order: 0,
          closed: false,
          color: null,
          is_default: false,
          is_folder: false,
          parent_id: null,
          item_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
  const next = lists.filter((row) => row.id !== tempId && row.id !== serverId);
  next.push(rewritten);
  await writeLocalLists(scope, next);

  // 迁移 temp list 下的 items 缓存键
  const tempItems = await readLocalItems(scope, tempId);
  if (tempItems.length > 0) {
    const migrated = tempItems.map((item) =>
      item.list_id === tempId ? { ...item, list_id: serverId } : item,
    );
    await writeLocalItems(scope, serverId, migrated);
    await writeCachedTaskItems(scope, tempId, []);
  }
}

async function rewriteLocalItemId(
  scope: string,
  tempId: number,
  serverId: number,
  serverRow?: TaskItemRow,
): Promise<void> {
  const lists = await readLocalLists(scope);
  for (const list of lists) {
    if (list.is_folder) continue;
    const items = await readLocalItems(scope, list.id);
    const existing = items.find((row) => row.id === tempId);
    if (!existing && !serverRow) continue;
    const rewritten: TaskItemRow = serverRow
      ? { ...serverRow }
      : existing
        ? { ...existing, id: serverId }
        : {
            id: serverId,
            title: "",
            content: "",
            tags: [],
            status: "pending",
            priority: "none",
            due_at: null,
            remind_at: null,
            list_id: list.id,
            project_id: null,
            milestone_id: null,
            sort_order: 0,
            completed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
    const next = items.filter((row) => row.id !== tempId && row.id !== serverId);
    next.push(rewritten);
    await writeLocalItems(scope, list.id, next);
    return;
  }
  if (serverRow?.list_id != null && !isTempId(serverRow.list_id)) {
    await upsertLocalItem(scope, serverRow);
  }
}

async function findLocalItem(
  scope: string,
  id: number,
): Promise<{ item: TaskItemRow; listId: number } | null> {
  const resolvedId = await resolveEntityId(scope, id);
  const lists = await readLocalLists(scope);
  for (const list of lists) {
    if (list.is_folder) continue;
    const items = await readLocalItems(scope, list.id);
    const found =
      items.find((row) => row.id === resolvedId) ??
      (resolvedId !== id ? items.find((row) => row.id === id) : undefined);
    if (found) return { item: found, listId: list.id };
  }
  return null;
}

async function mergeServerTaskItems(
  scope: string,
  listId: number,
  serverItems: TaskItemRow[],
): Promise<TaskItemRow[]> {
  const tempIds = await pendingTempItemIds(scope);
  if (tempIds.size === 0) return serverItems;
  const local = await readLocalItems(scope, listId);
  const serverIds = new Set(serverItems.map((row) => row.id));
  const pendingTemps = local.filter((row) => tempIds.has(row.id) && !serverIds.has(row.id));
  if (pendingTemps.length === 0) return serverItems;
  return [...pendingTemps, ...serverItems].toSorted(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  );
}

/** 把 outbox 中未 flush 的 tasklist.patch 叠到服务端行上，避免 loadLists 踩掉乐观 parent/name。 */
async function applyPendingListPatches(
  scope: string,
  lists: TaskListRow[],
): Promise<TaskListRow[]> {
  const ops = await listOutboxOps(scope, MODULE_ID);
  if (ops.length === 0) return lists;
  const byId = new Map(lists.map((row) => [row.id, { ...row }]));
  for (const op of ops) {
    if (op.method !== "tasklist.patch") continue;
    const id = op.payload.id;
    if (typeof id !== "number") continue;
    const row = byId.get(id);
    if (!row) continue;
    const patch = op.payload;
    byId.set(id, {
      ...row,
      ...(typeof patch.name === "string" ? { name: patch.name } : {}),
      ...(typeof patch.sort_order === "number" ? { sort_order: patch.sort_order } : {}),
      ...(typeof patch.closed === "boolean" ? { closed: patch.closed } : {}),
      ...(patch.color === null || typeof patch.color === "string" ? { color: patch.color } : {}),
      ...(typeof patch.is_folder === "boolean" ? { is_folder: patch.is_folder } : {}),
      ...(patch.parent_id === null || typeof patch.parent_id === "number"
        ? { parent_id: patch.parent_id }
        : {}),
    });
  }
  return [...byId.values()].toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

/**
 * 用服务器列表刷新本地缓存时，仅保留 outbox 中仍未同步的 temp 清单，
 * 并叠加上未 flush 的 patch，避免已同步负 id / 乐观移动被踩掉。
 */
async function mergeServerTaskLists(
  scope: string,
  serverLists: TaskListRow[],
): Promise<TaskListRow[]> {
  const tempIds = await pendingTempListIds(scope);
  const local = await readLocalLists(scope);
  const serverIds = new Set(serverLists.map((row) => row.id));
  const pendingTemps =
    tempIds.size === 0 ? [] : local.filter((row) => tempIds.has(row.id) && !serverIds.has(row.id));
  const base = pendingTemps.length === 0 ? serverLists : [...pendingTemps, ...serverLists];
  return applyPendingListPatches(scope, base);
}

/** 供 cache-first 读路径在写回服务器列表前调用，合并未同步的 temp 清单。 */
export async function reconcileServerTaskLists(serverLists: TaskListRow[]): Promise<TaskListRow[]> {
  return mergeServerTaskLists(resolveOutboxScope(), serverLists);
}

async function upsertLocalItem(scope: string, item: TaskItemRow): Promise<void> {
  if (item.list_id == null) return;
  const items = await readLocalItems(scope, item.list_id);
  const next = items.filter((row) => row.id !== item.id);
  next.push(item);
  await writeLocalItems(scope, item.list_id, next);
}

async function removeLocalItem(scope: string, listId: number, id: number): Promise<void> {
  const items = await readLocalItems(scope, listId);
  await writeLocalItems(
    scope,
    listId,
    items.filter((row) => row.id !== id),
  );
}

async function adjustListItemCount(scope: string, listId: number, delta: number): Promise<void> {
  if (delta === 0) return;
  const lists = await readLocalLists(scope);
  const idx = lists.findIndex((row) => row.id === listId);
  if (idx < 0) return;
  const list = lists[idx];
  if (!list || list.is_folder) return;
  lists[idx] = { ...list, item_count: Math.max(0, list.item_count + delta) };
  await writeLocalLists(scope, lists);
}

function scheduleFlush(scope: string): void {
  void flushOfflineModule(MODULE_ID, scope).catch(() => {});
}

function entitySortKey(op: OfflineOutboxOp): string | null {
  const id = op.payload.id;
  if (typeof id !== "number") return null;
  if (op.method === "tasklist.patch") return `list:${id}`;
  if (op.method === "task.patch") return `item:${id}`;
  return null;
}

function isSortOrderOnlyPatch(op: OfflineOutboxOp): boolean {
  if (op.method !== "tasklist.patch" && op.method !== "task.patch") return false;
  const allowed = new Set(["id", "sort_order", "subject_kind", "client_op_id"]);
  const keys = Object.keys(op.payload).filter((key) => op.payload[key] !== undefined);
  if (!keys.includes("sort_order")) return false;
  return keys.every((key) => allowed.has(key));
}

function mergePatchIntoCreate(
  createOp: OfflineOutboxOp,
  patchOp: OfflineOutboxOp,
): OfflineOutboxOp {
  const payload = { ...createOp.payload };
  const patch = { ...patchOp.payload };
  delete patch.id;
  Object.assign(payload, patch);
  return { ...createOp, payload, createdAt: patchOp.createdAt };
}

export function compactTaskOutbox(ops: OfflineOutboxOp[]): OfflineOutboxOp[] {
  const byTemp = new Map<number, OfflineOutboxOp>();
  const sortOrderByEntity = new Map<string, OfflineOutboxOp>();
  const result: OfflineOutboxOp[] = [];

  for (const op of ops) {
    if (op.method === "tasklist.delete" || op.method === "task.delete") {
      const id = op.payload.id;
      if (typeof id === "number" && isTempId(id)) {
        byTemp.delete(id);
        continue;
      }
      if (typeof id === "number") {
        const prefix = op.method === "tasklist.delete" ? "list:" : "item:";
        sortOrderByEntity.delete(`${prefix}${id}`);
      }
      result.push(op);
      continue;
    }

    if (
      (op.method === "tasklist.create" || op.method === "tasklist.item.create") &&
      op.tempEntityId != null
    ) {
      const prev = byTemp.get(op.tempEntityId);
      if (prev) {
        byTemp.set(op.tempEntityId, {
          ...prev,
          payload: { ...prev.payload, ...op.payload },
          createdAt: op.createdAt,
        });
      } else {
        byTemp.set(op.tempEntityId, op);
      }
      continue;
    }

    if (op.method === "tasklist.patch" || op.method === "task.patch") {
      const id = op.payload.id;
      if (typeof id === "number" && isTempId(id)) {
        const createOp = byTemp.get(id);
        if (createOp) {
          byTemp.set(id, mergePatchIntoCreate(createOp, op));
          continue;
        }
      }
      if (isSortOrderOnlyPatch(op)) {
        const key = entitySortKey(op);
        if (key) {
          sortOrderByEntity.set(key, op);
          continue;
        }
      }
    }

    result.push(op);
  }

  return [...byTemp.values(), ...sortOrderByEntity.values(), ...result].toSorted((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

/** 本轮 flush 成功写入的 methods；仅清单元数据时跳过全量 tasklist.item.list。 */
const flushedMethodsBuffer = new Set<string>();

const LIST_META_ONLY_METHODS = new Set(["tasklist.create", "tasklist.patch", "tasklist.delete"]);

function takeFlushedMethods(): Set<string> {
  const methods = new Set(flushedMethodsBuffer);
  flushedMethodsBuffer.clear();
  return methods;
}

function shouldRefreshAllTaskItems(methods: Set<string>): boolean {
  if (methods.size === 0) return true;
  return ![...methods].every((m) => LIST_META_ONLY_METHODS.has(m));
}

async function flushTaskOp(
  op: OfflineOutboxOp,
  scope: string,
): Promise<import("@freeanima/frontend/shell-sdk/offline-module-types").FlushOpOutcome> {
  const hub = getTypedSatelliteHubClient();
  try {
    const result = (await hub.call(op.method as "tasklist.create", op.payload as never)) as {
      item?: TaskListRow | TaskItemRow;
      ok?: true;
    };
    if (op.tempEntityId != null && result.item?.id) {
      await recordFlushIdMapping(scope, MODULE_ID, op.tempEntityId, result.item.id);
      if (op.method === "tasklist.create") {
        await rewriteLocalListId(
          scope,
          op.tempEntityId,
          result.item.id,
          result.item as TaskListRow,
        );
      } else if (op.method === "tasklist.item.create") {
        await rewriteLocalItemId(
          scope,
          op.tempEntityId,
          result.item.id,
          result.item as TaskItemRow,
        );
      }
    }
    return { status: "done" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", error: message };
  }
}

export const taskRpcAdapter: RpcModuleAdapter = {
  kind: "rpc",
  moduleId: MODULE_ID,
  ordering: "topological",
  compactOutbox: compactTaskOutbox,
  resolvePayloadIds: (payload, idMap) =>
    resolveIdFields(payload, idMap, ["id", "list_id", "parent_id"]),
  flushOp: async (op, ctx) => {
    const outcome = await flushTaskOp(op, ctx.scope);
    if (outcome.status === "done") flushedMethodsBuffer.add(op.method);
    return outcome;
  },
  refreshAll: async (scope) => {
    const flushedMethods = takeFlushedMethods();
    const hub = getTypedSatelliteHubClient();
    const localLists = await readLocalLists(scope);
    const cachedListIds = localLists.filter((list) => !list.is_folder).map((list) => list.id);

    try {
      const data = await hub.call("tasklist.list", {
        ...subjectPayload(),
        include_closed: true,
      });
      const merged = await mergeServerTaskLists(scope, data.lists);
      await writeLocalLists(scope, merged);
      for (const list of merged) {
        if (!list.is_folder && !cachedListIds.includes(list.id)) cachedListIds.push(list.id);
      }
    } catch {
      /* keep local snapshot */
    }

    if (!shouldRefreshAllTaskItems(flushedMethods)) return;

    const listIds = [...new Set(cachedListIds)];
    for (const listId of listIds) {
      if (isTempId(listId)) continue;
      try {
        const itemData = await hub.call("tasklist.item.list", {
          ...subjectPayload(),
          list_id: listId,
          status: "all",
        });
        const mergedItems = await mergeServerTaskItems(scope, listId, itemData.items);
        await writeLocalItems(scope, listId, mergedItems);
      } catch {
        /* keep local snapshot */
      }
    }
  },
};

export function registerTaskOfflineModule(): void {
  registerOfflineModule(taskRpcAdapter);
  registerOfflineModuleCap(MODULE_ID, { offlineWritable: true });
  void ensureAllocatorSeeded(resolveOutboxScope()).catch(() => {});
}

export async function offlineCreateTaskList(input: {
  name: string;
  is_folder?: boolean;
  parent_id?: number | null;
  sort_order?: number;
  color?: string | null;
}): Promise<TaskListRow> {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("task list name is required");

  const scope = resolveOutboxScope();
  await ensureAllocatorSeeded(scope);
  const tempId = allocateTempId(scope, MODULE_ID);
  const opId = randomUuid();
  const now = new Date().toISOString();
  const row: TaskListRow = {
    id: tempId,
    name,
    sort_order: input.sort_order ?? 0,
    closed: false,
    color: input.color ?? null,
    is_default: false,
    is_folder: input.is_folder ?? false,
    parent_id: input.parent_id ?? null,
    item_count: 0,
    created_at: now,
    updated_at: now,
  };
  await upsertLocalList(scope, row);
  await enqueueOutboxOp(scope, {
    id: opId,
    moduleId: MODULE_ID,
    method: "tasklist.create",
    payload: {
      ...subjectPayload(),
      client_op_id: opId,
      name: row.name,
      sort_order: row.sort_order,
      color: row.color,
      is_folder: row.is_folder,
      parent_id: row.parent_id,
    },
    tempEntityId: tempId,
    createdAt: now,
  });
  scheduleFlush(scope);
  return row;
}

export async function offlineUpdateTaskList(
  id: number,
  patch: Partial<
    Pick<TaskListRow, "name" | "sort_order" | "closed" | "color" | "is_folder" | "parent_id">
  >,
): Promise<TaskListRow> {
  const scope = resolveOutboxScope();
  const lists = await readLocalLists(scope);
  const resolvedId = await resolveEntityId(scope, id);
  const existing =
    lists.find((row) => row.id === resolvedId) ??
    (resolvedId !== id ? lists.find((row) => row.id === id) : undefined);
  if (!existing) throw new Error("task list not found locally");

  const now = new Date().toISOString();
  const updated: TaskListRow = {
    ...existing,
    ...patch,
    updated_at: now,
  };
  await upsertLocalList(scope, updated);

  const opId = randomUuid();
  await enqueueOutboxOp(scope, {
    id: opId,
    moduleId: MODULE_ID,
    method: "tasklist.patch",
    payload: {
      ...subjectPayload(),
      id: existing.id,
      client_op_id: opId,
      ...patch,
    },
    createdAt: now,
  });
  scheduleFlush(scope);
  return updated;
}

export async function offlineDeleteTaskList(id: number): Promise<void> {
  const scope = resolveOutboxScope();
  const resolvedId = await resolveEntityId(scope, id);
  await removeLocalList(scope, resolvedId);
  if (resolvedId !== id) await removeLocalList(scope, id);

  if (isTempId(resolvedId) || isTempId(id)) {
    const tempIds = new Set([id, resolvedId].filter(isTempId));
    const ops = await listOutboxOps(scope, MODULE_ID);
    for (const op of ops) {
      if (
        (typeof op.tempEntityId === "number" && tempIds.has(op.tempEntityId)) ||
        (typeof op.payload.id === "number" &&
          (tempIds.has(op.payload.id) || op.payload.id === resolvedId))
      ) {
        await removeOutboxOp(scope, op.id);
      }
    }
    return;
  }

  const opId = randomUuid();
  await enqueueOutboxOp(scope, {
    id: opId,
    moduleId: MODULE_ID,
    method: "tasklist.delete",
    payload: {
      ...subjectPayload(),
      id: resolvedId,
      cascade: true,
      client_op_id: opId,
    },
    createdAt: new Date().toISOString(),
  });
  scheduleFlush(scope);
}

export async function offlineCreateTaskItem(input: {
  title: string;
  list_id: number;
  content?: string;
  tags?: string[];
  priority?: TaskItemRow["priority"];
  due_at?: string | null;
  sort_order?: number;
}): Promise<TaskItemRow> {
  const title = input.title.trim();
  if (title.length === 0) throw new Error("task title is required");

  const scope = resolveOutboxScope();
  await ensureAllocatorSeeded(scope);
  const tempId = allocateTempId(scope, MODULE_ID);
  const opId = randomUuid();
  const now = new Date().toISOString();
  const row: TaskItemRow = {
    id: tempId,
    title,
    content: input.content?.trim() ?? "",
    tags: input.tags ?? [],
    status: "pending",
    priority: input.priority ?? "none",
    due_at: input.due_at ?? null,
    remind_at: null,
    list_id: input.list_id,
    project_id: null,
    milestone_id: null,
    sort_order: input.sort_order ?? 0,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
  await upsertLocalItem(scope, row);
  if (row.list_id != null) {
    await adjustListItemCount(scope, row.list_id, 1);
  }

  const baseOp = {
    id: opId,
    moduleId: MODULE_ID,
    method: "tasklist.item.create",
    payload: {
      ...subjectPayload(),
      client_op_id: opId,
      title: row.title,
      list_id: row.list_id,
      content: row.content,
      tags: row.tags,
      priority: row.priority,
      due_at: row.due_at,
      sort_order: row.sort_order,
    },
    tempEntityId: tempId,
    createdAt: now,
  } satisfies OfflineOutboxOp;

  if (isTempId(input.list_id)) {
    await enqueueOutboxOp(scope, {
      ...baseOp,
      dependsOn: [{ tempId: input.list_id, field: "list_id" }],
    });
  } else {
    await enqueueOutboxOp(scope, baseOp);
  }
  scheduleFlush(scope);
  return row;
}

export async function offlineUpdateTaskItem(
  id: number,
  patch: Partial<
    Pick<
      TaskItemRow,
      | "title"
      | "content"
      | "tags"
      | "priority"
      | "due_at"
      | "list_id"
      | "project_id"
      | "milestone_id"
      | "status"
      | "sort_order"
    >
  >,
): Promise<TaskItemRow> {
  const scope = resolveOutboxScope();
  const found = await findLocalItem(scope, id);
  if (!found) throw new Error("task item not found locally");
  const existing = found.item;
  const sourceListId = found.listId;

  const now = new Date().toISOString();
  const patchProjectId = patch.project_id;
  const movingToProject = typeof patchProjectId === "number";
  const nextProjectId: number | null = movingToProject
    ? patchProjectId
    : patchProjectId === null
      ? null
      : (existing.project_id ?? null);
  const nextListId: number | null = movingToProject
    ? null
    : (patch.list_id ?? existing.list_id ?? null);
  const nextStatus = patch.status ?? existing.status;
  const updated: TaskItemRow = {
    ...existing,
    ...patch,
    list_id: nextListId,
    project_id: nextProjectId,
    milestone_id:
      movingToProject || patch.project_id === null || patch.list_id != null
        ? (patch.milestone_id ?? null)
        : (patch.milestone_id ?? existing.milestone_id),
    status: nextStatus,
    completed_at:
      patch.status === "completed"
        ? formatCstIso(new Date())
        : patch.status === "pending"
          ? null
          : existing.completed_at,
    updated_at: now,
  };

  if (movingToProject || nextListId == null) {
    await removeLocalItem(scope, sourceListId, existing.id);
    if (existing.status === "pending") await adjustListItemCount(scope, sourceListId, -1);
  } else if (nextListId !== sourceListId) {
    await removeLocalItem(scope, sourceListId, existing.id);
    await upsertLocalItem(scope, updated);
    if (existing.status === "pending") await adjustListItemCount(scope, sourceListId, -1);
    if (nextStatus === "pending") await adjustListItemCount(scope, nextListId, 1);
  } else {
    await upsertLocalItem(scope, updated);
    if (existing.status === "pending" && nextStatus === "completed") {
      await adjustListItemCount(scope, sourceListId, -1);
    } else if (existing.status === "completed" && nextStatus === "pending") {
      await adjustListItemCount(scope, sourceListId, 1);
    }
  }

  const opId = randomUuid();
  const movingToList = !movingToProject && patch.list_id != null;
  const entityId = existing.id;

  if (movingToProject) {
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "task.moveToProject",
      payload: omitUndefined({
        ...subjectPayload(),
        id: entityId,
        client_op_id: opId,
        project_id: patch.project_id,
        sort_order: patch.sort_order,
      }),
      createdAt: now,
    });
  } else if (movingToList) {
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "task.moveToList",
      payload: omitUndefined({
        ...subjectPayload(),
        id: entityId,
        client_op_id: opId,
        list_id: patch.list_id,
        sort_order: patch.sort_order,
      }),
      createdAt: now,
    });
  } else {
    const { list_id: _listId, project_id: _projectId, ...contentPatch } = patch;
    await enqueueOutboxOp(scope, {
      id: opId,
      moduleId: MODULE_ID,
      method: "task.patch",
      payload: {
        ...subjectPayload(),
        id: entityId,
        client_op_id: opId,
        ...contentPatch,
      },
      createdAt: now,
    });
  }
  scheduleFlush(scope);
  return updated;
}

export async function offlineDeleteTaskItem(id: number, listId?: number): Promise<void> {
  const scope = resolveOutboxScope();
  const found = await findLocalItem(scope, id);
  const resolvedId = found?.item.id ?? (await resolveEntityId(scope, id));

  let resolvedListId = listId ?? found?.listId;
  let wasPending = found?.item.status === "pending";
  if (resolvedListId == null) {
    const lists = await readLocalLists(scope);
    for (const list of lists) {
      if (list.is_folder) continue;
      const items = await readLocalItems(scope, list.id);
      const row = items.find((r) => r.id === resolvedId || r.id === id);
      if (row) {
        resolvedListId = list.id;
        wasPending = row.status === "pending";
        break;
      }
    }
  } else if (found == null) {
    const items = await readLocalItems(scope, resolvedListId);
    wasPending = items.find((row) => row.id === resolvedId || row.id === id)?.status === "pending";
  }

  if (resolvedListId != null) {
    await removeLocalItem(scope, resolvedListId, resolvedId);
    if (resolvedId !== id) await removeLocalItem(scope, resolvedListId, id);
    if (wasPending) await adjustListItemCount(scope, resolvedListId, -1);
  }

  if (isTempId(resolvedId) || isTempId(id)) {
    const tempIds = new Set([id, resolvedId].filter(isTempId));
    const ops = await listOutboxOps(scope, MODULE_ID);
    for (const op of ops) {
      if (
        (typeof op.tempEntityId === "number" && tempIds.has(op.tempEntityId)) ||
        (typeof op.payload.id === "number" &&
          (tempIds.has(op.payload.id) || op.payload.id === resolvedId))
      ) {
        await removeOutboxOp(scope, op.id);
      }
    }
    return;
  }

  const opId = randomUuid();
  await enqueueOutboxOp(scope, {
    id: opId,
    moduleId: MODULE_ID,
    method: "task.delete",
    payload: {
      ...subjectPayload(),
      id: resolvedId,
      client_op_id: opId,
    },
    createdAt: new Date().toISOString(),
  });
  scheduleFlush(scope);
}

export async function countTaskPendingOps(): Promise<number> {
  return listOutboxOps(resolveOutboxScope(), MODULE_ID).then((ops) => ops.length);
}
