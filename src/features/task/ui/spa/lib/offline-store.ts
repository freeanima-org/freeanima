import { getSubjectKind } from "@freeanima/frontend/shell-sdk";
import { resolveIdFields } from "@freeanima/frontend/shell-sdk/offline-id-map";
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
import { allocateTempId, isTempId } from "@freeanima/frontend/shell-sdk/offline-temp-id";
import { formatCstIso } from "@freeanima/core/util";
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

async function upsertLocalItem(scope: string, item: TaskItemRow): Promise<void> {
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
      (op.method === "tasklist.create" || op.method === "task.create") &&
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

async function flushTaskOp(op: OfflineOutboxOp, scope: string): Promise<"done" | "failed"> {
  const hub = getTypedSatelliteHubClient();
  try {
    const result = (await hub.call(op.method as "tasklist.create", op.payload as never)) as {
      item?: TaskListRow | TaskItemRow;
      ok?: true;
    };
    if (op.tempEntityId != null && result.item?.id) {
      await recordFlushIdMapping(scope, MODULE_ID, op.tempEntityId, result.item.id);
    }
    return "done";
  } catch {
    return "failed";
  }
}

export const taskRpcAdapter: RpcModuleAdapter = {
  kind: "rpc",
  moduleId: MODULE_ID,
  ordering: "topological",
  compactOutbox: compactTaskOutbox,
  resolvePayloadIds: (payload, idMap) =>
    resolveIdFields(payload, idMap, ["id", "list_id", "parent_id"]),
  flushOp: async (op, ctx) => flushTaskOp(op, ctx.scope),
  refreshAll: async (scope) => {
    const hub = getTypedSatelliteHubClient();
    const localLists = await readLocalLists(scope);
    const tempLists = localLists.filter((list) => isTempId(list.id));
    const cachedListIds = localLists.filter((list) => !list.is_folder).map((list) => list.id);

    try {
      const data = await hub.call("tasklist.list", {
        ...subjectPayload(),
        include_closed: true,
      });
      const merged = [
        ...data.lists,
        ...tempLists.filter((temp) => !data.lists.some((row) => row.id === temp.id)),
      ];
      await writeLocalLists(scope, merged);
      for (const list of merged) {
        if (!list.is_folder && !cachedListIds.includes(list.id)) cachedListIds.push(list.id);
      }
    } catch {
      /* keep local snapshot */
    }

    const listIds = [...new Set(cachedListIds)];
    for (const listId of listIds) {
      if (isTempId(listId)) continue;
      try {
        const itemData = await hub.call("task.list", {
          ...subjectPayload(),
          list_id: listId,
          status: "all",
        });
        await writeLocalItems(scope, listId, itemData.items);
      } catch {
        /* keep local snapshot */
      }
    }
  },
};

export function registerTaskOfflineModule(): void {
  registerOfflineModule(taskRpcAdapter);
  registerOfflineModuleCap(MODULE_ID, { offlineWritable: true });
}

export async function offlineCreateTaskList(input: {
  name: string;
  is_folder?: boolean;
  parent_id?: number | null;
  sort_order?: number;
  color?: string | null;
}): Promise<TaskListRow> {
  const scope = resolveOutboxScope();
  const tempId = allocateTempId(scope, MODULE_ID);
  const opId = randomUuid();
  const now = new Date().toISOString();
  const row: TaskListRow = {
    id: tempId,
    name: input.name.trim(),
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
  const existing = lists.find((row) => row.id === id);
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
      id,
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
  await removeLocalList(scope, id);

  if (isTempId(id)) {
    const ops = await listOutboxOps(scope, MODULE_ID);
    for (const op of ops) {
      if (op.tempEntityId === id || op.payload.id === id) {
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
      id,
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
  const scope = resolveOutboxScope();
  const tempId = allocateTempId(scope, MODULE_ID);
  const opId = randomUuid();
  const now = new Date().toISOString();
  const row: TaskItemRow = {
    id: tempId,
    title: input.title.trim(),
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
  await adjustListItemCount(scope, row.list_id, 1);

  const baseOp = {
    id: opId,
    moduleId: MODULE_ID,
    method: "task.create",
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
  const lists = await readLocalLists(scope);
  let existing: TaskItemRow | undefined;
  let sourceListId: number | undefined;

  for (const list of lists) {
    if (list.is_folder) continue;
    const items = await readLocalItems(scope, list.id);
    const found = items.find((row) => row.id === id);
    if (found) {
      existing = found;
      sourceListId = list.id;
      break;
    }
  }
  if (!existing || sourceListId == null) throw new Error("task item not found locally");

  const now = new Date().toISOString();
  const nextListId = patch.list_id ?? existing.list_id;
  const nextStatus = patch.status ?? existing.status;
  const updated: TaskItemRow = {
    ...existing,
    ...patch,
    list_id: nextListId,
    status: nextStatus,
    completed_at:
      patch.status === "completed"
        ? formatCstIso(new Date())
        : patch.status === "pending"
          ? null
          : existing.completed_at,
    updated_at: now,
  };

  if (nextListId !== sourceListId) {
    await removeLocalItem(scope, sourceListId, id);
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
  await enqueueOutboxOp(scope, {
    id: opId,
    moduleId: MODULE_ID,
    method: "task.patch",
    payload: {
      ...subjectPayload(),
      id,
      client_op_id: opId,
      ...patch,
    },
    createdAt: now,
  });
  scheduleFlush(scope);
  return updated;
}

export async function offlineDeleteTaskItem(id: number, listId?: number): Promise<void> {
  const scope = resolveOutboxScope();

  let resolvedListId = listId;
  let wasPending = false;
  if (resolvedListId == null) {
    const lists = await readLocalLists(scope);
    for (const list of lists) {
      if (list.is_folder) continue;
      const items = await readLocalItems(scope, list.id);
      const found = items.find((row) => row.id === id);
      if (found) {
        resolvedListId = list.id;
        wasPending = found.status === "pending";
        break;
      }
    }
  } else {
    const items = await readLocalItems(scope, resolvedListId);
    wasPending = items.find((row) => row.id === id)?.status === "pending";
  }

  if (resolvedListId != null) {
    await removeLocalItem(scope, resolvedListId, id);
    if (wasPending) await adjustListItemCount(scope, resolvedListId, -1);
  }

  if (isTempId(id)) {
    const ops = await listOutboxOps(scope, MODULE_ID);
    for (const op of ops) {
      if (op.tempEntityId === id || op.payload.id === id) {
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
      id,
      client_op_id: opId,
    },
    createdAt: new Date().toISOString(),
  });
  scheduleFlush(scope);
}

export async function countTaskPendingOps(): Promise<number> {
  return listOutboxOps(resolveOutboxScope(), MODULE_ID).then((ops) => ops.length);
}
