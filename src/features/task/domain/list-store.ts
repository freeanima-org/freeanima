import {
  TASK_LIST_COMPONENT,
  asTaskList,
  type TaskListBody,
} from "@freeanima/core/db/schema/entity";
import { assertEntityInWorld, assertSameWorldReferent } from "@freeanima/core/db/pg/entity";
import { omitUndefined } from "@freeanima/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  searchEntities,
  updateEntity,
} from "@freeanima/core/db/pg/entity";

import type {
  TaskListCreateInput,
  TaskListRow,
  TaskListSearchOpts,
  TaskListUpdateInput,
} from "./types.ts";

export const ARCHIVED_TASK_LIST_ERROR = "清单已归档";

function resolveParentId(body: Record<string, unknown>): number | null {
  const v = body.parent_id;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveIsFolder(body: Record<string, unknown>): boolean {
  return body.is_folder === true;
}

function resolveClosed(body: Record<string, unknown>): boolean {
  return body.closed === true;
}

async function countItemsForList(listId: number, worldId: number): Promise<number> {
  const items = await listEntities({
    world_id: worldId,
    primary_component: "task_item",
    limit: 500,
  });
  return items.filter(
    (item) => Number(item.body.list_id) === listId && item.body.status !== "completed",
  ).length;
}

function toListRow(
  row: NonNullable<ReturnType<typeof asTaskList>>,
  meta: { created_at: Date; updated_at: Date; item_count: number },
): TaskListRow {
  const is_folder = row.is_folder ?? false;
  return {
    id: row.id,
    name: row.name,
    sort_order: row.sort_order ?? 0,
    closed: row.closed ?? false,
    color: row.color ?? null,
    is_default: row.is_default ?? false,
    is_folder,
    parent_id: row.parent_id ?? null,
    item_count: is_folder ? 0 : meta.item_count,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

function assertDefaultListConstraints(
  existing: { body: Record<string, unknown> },
  patch: { is_folder?: boolean; parent_id?: number | null },
): void {
  const isDefault = existing.body.is_default === true;
  if (!isDefault) return;
  if (patch.is_folder === true) {
    throw new Error("default task list cannot be a folder");
  }
  if (patch.parent_id != null) {
    throw new Error("default task list cannot be placed in a folder");
  }
}

function assertCanCloseTaskList(existing: { body: Record<string, unknown> }): void {
  if (existing.body.is_default === true) {
    throw new Error("default task list cannot be closed");
  }
  if (resolveIsFolder(existing.body)) {
    throw new Error("folders cannot be archived");
  }
}

function isReopenPatch(input: TaskListUpdateInput): boolean {
  return (
    input.closed === false &&
    input.name === undefined &&
    input.sort_order === undefined &&
    input.color === undefined &&
    input.is_folder === undefined &&
    input.parent_id === undefined
  );
}

function assertArchivedListMutationAllowed(
  existing: { body: Record<string, unknown> },
  input: TaskListUpdateInput,
): void {
  if (!resolveClosed(existing.body) || resolveIsFolder(existing.body)) return;
  if (isReopenPatch(input)) return;
  throw new Error(ARCHIVED_TASK_LIST_ERROR);
}

export async function assertTaskListNotArchived(listId: number, worldId: number): Promise<void> {
  const existing = await getEntity(listId);
  if (!existing || existing.primary_component !== TASK_LIST_COMPONENT) {
    throw new Error("task list not found");
  }
  await assertEntityInWorld(listId, worldId);
  if (resolveClosed(existing.body) && !resolveIsFolder(existing.body)) {
    throw new Error(ARCHIVED_TASK_LIST_ERROR);
  }
}

async function getChildListIds(parentId: number, worldId: number): Promise<number[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: TASK_LIST_COMPONENT,
    limit: 200,
  });
  return rows.filter((row) => resolveParentId(row.body) === parentId).map((row) => row.id);
}

async function assertValidParent(
  childId: number,
  parentId: number | null,
  worldId: number,
): Promise<void> {
  if (parentId == null) return;
  if (parentId === childId) {
    throw new Error("list cannot be its own parent");
  }
  const parent = await getEntity(parentId);
  if (!parent || parent.primary_component !== TASK_LIST_COMPONENT) {
    throw new Error("parent folder not found");
  }
  await assertEntityInWorld(parentId, worldId);
  if (!resolveIsFolder(parent.body)) {
    throw new Error("parent must be a folder");
  }
  await assertNoCycle(childId, parentId, worldId);
}

async function assertNoCycle(childId: number, parentId: number, worldId: number): Promise<void> {
  let current: number | null = parentId;
  const visited = new Set<number>();
  while (current != null) {
    if (current === childId) {
      throw new Error("folder nesting would create a cycle");
    }
    if (visited.has(current)) break;
    visited.add(current);
    const row = await getEntity(current);
    if (!row || row.primary_component !== TASK_LIST_COMPONENT) break;
    await assertEntityInWorld(current, worldId);
    current = resolveParentId(row.body);
  }
}

async function assertFolderHasNoChildren(id: number, worldId: number): Promise<void> {
  const children = await getChildListIds(id, worldId);
  if (children.length > 0) {
    throw new Error("folder has children and cannot be converted to a list");
  }
}

/** 递归解散文件夹树：子文件夹删除，所有清单升至根级 */
async function dissolveFolderTree(folderId: number, worldId: number): Promise<void> {
  const children = await getChildListIds(folderId, worldId);
  for (const childId of children) {
    const child = await getEntity(childId);
    if (!child) continue;
    if (resolveIsFolder(child.body)) {
      await dissolveFolderTree(childId, worldId);
      await deleteEntity(childId);
    } else {
      await updateEntity({ id: childId, body: { parent_id: null } });
    }
  }
}

async function deleteTasksInList(listId: number, worldId: number): Promise<void> {
  const items = await listEntities({
    world_id: worldId,
    primary_component: "task_item",
    limit: 500,
  });
  for (const item of items) {
    if (Number(item.body.list_id) === listId) {
      await deleteEntity(item.id);
    }
  }
}

export async function assertListAcceptsTasks(listId: number, worldId: number): Promise<void> {
  const existing = await getEntity(listId);
  if (!existing || existing.primary_component !== TASK_LIST_COMPONENT) {
    throw new Error("task list not found");
  }
  await assertEntityInWorld(listId, worldId);
  if (resolveIsFolder(existing.body)) {
    throw new Error("tasks cannot be assigned to a folder");
  }
  if (resolveClosed(existing.body)) {
    throw new Error(ARCHIVED_TASK_LIST_ERROR);
  }
}

/** 按 world 懒创建默认 Inbox（幂等） */
export async function ensureDefaultTaskListForWorld(worldId: number): Promise<TaskListRow> {
  const lists = await listTaskLists(worldId, { includeClosed: true });
  const existing = lists.find((l) => l.is_default);
  if (existing) return existing;

  const body: TaskListBody = {
    sort_order: 0,
    closed: false,
    color: null,
    is_default: true,
    is_folder: false,
    parent_id: null,
  };
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [TASK_LIST_COMPONENT],
    primary_component: TASK_LIST_COMPONENT,
    title: "收件箱",
    body,
  });
  const parsed = asTaskList(row);
  if (!parsed) throw new Error("failed to create default task list");
  return toListRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: 0,
  });
}

export async function listTaskLists(
  worldId: number,
  opts?: { includeClosed?: boolean },
): Promise<TaskListRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: TASK_LIST_COMPONENT,
    limit: 200,
  });
  const lists: TaskListRow[] = [];
  for (const row of rows) {
    const parsed = asTaskList(row);
    if (!parsed) continue;
    if (!opts?.includeClosed && (parsed.closed ?? false)) continue;
    const is_folder = parsed.is_folder ?? false;
    const item_count = is_folder ? 0 : await countItemsForList(parsed.id, worldId);
    lists.push(
      toListRow(parsed, {
        created_at: row.created_at,
        updated_at: row.updated_at,
        item_count,
      }),
    );
  }
  return lists.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function getDefaultTaskList(worldId: number): Promise<TaskListRow> {
  return ensureDefaultTaskListForWorld(worldId);
}

export async function createTaskList(
  worldId: number,
  input: TaskListCreateInput,
): Promise<TaskListRow> {
  const is_folder = input.is_folder ?? false;
  const parent_id = input.parent_id ?? null;

  if (!is_folder && parent_id != null) {
    await assertValidParent(-1, parent_id, worldId);
  }
  if (is_folder && parent_id != null) {
    await assertValidParent(-1, parent_id, worldId);
  }

  const body: TaskListBody = {
    sort_order: input.sort_order ?? 0,
    closed: false,
    color: input.color ?? null,
    is_default: false,
    is_folder,
    parent_id,
  };
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [TASK_LIST_COMPONENT],
    primary_component: TASK_LIST_COMPONENT,
    title: input.name.trim(),
    body,
  });
  const parsed = asTaskList(row);
  if (!parsed) throw new Error("failed to create task list");
  return toListRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: 0,
  });
}

export async function updateTaskList(
  worldId: number,
  input: TaskListUpdateInput,
): Promise<TaskListRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== TASK_LIST_COMPONENT) return null;
  await assertEntityInWorld(input.id, worldId);

  assertArchivedListMutationAllowed(existing, input);

  assertDefaultListConstraints(
    existing,
    omitUndefined({
      is_folder: input.is_folder,
      parent_id: input.parent_id,
    }),
  );

  if (input.closed === true) {
    assertCanCloseTaskList(existing);
  }

  if (input.is_folder === false && resolveIsFolder(existing.body)) {
    await assertFolderHasNoChildren(input.id, worldId);
  }

  if (input.parent_id !== undefined) {
    await assertValidParent(input.id, input.parent_id, worldId);
    if (input.parent_id != null) {
      await assertSameWorldReferent(input.id, input.parent_id);
    }
  }

  const bodyPatch: Record<string, unknown> = {};
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.closed !== undefined) bodyPatch.closed = input.closed;
  if (input.color !== undefined) bodyPatch.color = input.color;
  if (input.is_folder !== undefined) bodyPatch.is_folder = input.is_folder;
  if (input.parent_id !== undefined) bodyPatch.parent_id = input.parent_id;

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.name?.trim(),
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;

  const parsed = asTaskList(row);
  if (!parsed) return null;
  const is_folder = parsed.is_folder ?? false;
  const item_count = is_folder ? 0 : await countItemsForList(parsed.id, worldId);
  return toListRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count,
  });
}

export async function deleteTaskList(
  worldId: number,
  id: number,
  opts?: { cascade?: boolean },
): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== TASK_LIST_COMPONENT) return false;
  await assertEntityInWorld(id, worldId);
  if (existing.body.is_default === true) {
    throw new Error("default task list cannot be deleted");
  }

  if (resolveIsFolder(existing.body)) {
    await dissolveFolderTree(id, worldId);
  } else if (opts?.cascade !== false) {
    await deleteTasksInList(id, worldId);
  }

  return deleteEntity(id);
}

export async function closeTaskList(worldId: number, id: number): Promise<TaskListRow | null> {
  return updateTaskList(worldId, { id, closed: true });
}

export async function reopenTaskList(worldId: number, id: number): Promise<TaskListRow | null> {
  return updateTaskList(worldId, { id, closed: false });
}

export async function searchTaskLists(
  worldId: number,
  opts: TaskListSearchOpts,
): Promise<TaskListRow[]> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_LIST_COMPONENT,
    query: opts.query,
    limit: Math.max(1, Math.min(50, opts.limit ?? 30)),
    mode: "hybrid",
  });

  const lists: TaskListRow[] = [];
  for (const row of result.results) {
    const parsed = asTaskList(row);
    if (!parsed) continue;
    if (!opts.includeClosed && (parsed.closed ?? false)) continue;
    const is_folder = parsed.is_folder ?? false;
    const item_count = is_folder ? 0 : await countItemsForList(parsed.id, worldId);
    lists.push(
      toListRow(parsed, {
        created_at: row.created_at,
        updated_at: row.updated_at,
        item_count,
      }),
    );
  }
  return lists;
}
