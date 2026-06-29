import {
  ENTITY_DEFAULT_TASK_LIST_ID,
  TASK_LIST_COMPONENT,
  asTaskList,
  type TaskListBody,
} from "@freeanima/core/db/schema/entity";
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

export function defaultTaskWorldId(): number {
  return 1;
}

function resolveParentId(body: Record<string, unknown>): number | null {
  const v = body.parent_id;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveIsFolder(body: Record<string, unknown>): boolean {
  return body.is_folder === true;
}

async function countItemsForList(listId: number): Promise<number> {
  const items = await listEntities({
    world_id: defaultTaskWorldId(),
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

export function isDefaultTaskListId(id: number): boolean {
  return id === ENTITY_DEFAULT_TASK_LIST_ID;
}

function assertDefaultListConstraints(
  id: number,
  existing: { body: Record<string, unknown> },
  patch: { is_folder?: boolean; parent_id?: number | null },
): void {
  const isDefault = isDefaultTaskListId(id) || existing.body.is_default === true;
  if (!isDefault) return;
  if (patch.is_folder === true) {
    throw new Error("default task list cannot be a folder");
  }
  if (patch.parent_id != null) {
    throw new Error("default task list cannot be placed in a folder");
  }
}

function assertCanCloseTaskList(id: number, existing: { body: Record<string, unknown> }): void {
  if (isDefaultTaskListId(id) || existing.body.is_default === true) {
    throw new Error("default task list cannot be closed");
  }
}

async function getChildListIds(parentId: number): Promise<number[]> {
  const rows = await listEntities({
    world_id: defaultTaskWorldId(),
    primary_component: TASK_LIST_COMPONENT,
    limit: 200,
  });
  return rows.filter((row) => resolveParentId(row.body) === parentId).map((row) => row.id);
}

async function assertValidParent(childId: number, parentId: number | null): Promise<void> {
  if (parentId == null) return;
  if (parentId === childId) {
    throw new Error("list cannot be its own parent");
  }
  const parent = await getEntity(parentId);
  if (!parent || parent.primary_component !== TASK_LIST_COMPONENT) {
    throw new Error("parent folder not found");
  }
  if (!resolveIsFolder(parent.body)) {
    throw new Error("parent must be a folder");
  }
  await assertNoCycle(childId, parentId);
}

async function assertNoCycle(childId: number, parentId: number): Promise<void> {
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
    current = resolveParentId(row.body);
  }
}

async function assertFolderHasNoChildren(id: number): Promise<void> {
  const children = await getChildListIds(id);
  if (children.length > 0) {
    throw new Error("folder has children and cannot be converted to a list");
  }
}

async function deleteTasksInList(listId: number): Promise<void> {
  const items = await listEntities({
    world_id: defaultTaskWorldId(),
    primary_component: "task_item",
    limit: 500,
  });
  for (const item of items) {
    if (Number(item.body.list_id) === listId) {
      await deleteEntity(item.id);
    }
  }
}

async function cascadeClosedState(id: number, closed: boolean): Promise<void> {
  const children = await getChildListIds(id);
  for (const childId of children) {
    await updateEntity({ id: childId, body: { closed } });
    const child = await getEntity(childId);
    if (child && resolveIsFolder(child.body)) {
      await cascadeClosedState(childId, closed);
    }
  }
}

export async function assertListAcceptsTasks(listId: number): Promise<void> {
  const existing = await getEntity(listId);
  if (!existing || existing.primary_component !== TASK_LIST_COMPONENT) {
    throw new Error("task list not found");
  }
  if (resolveIsFolder(existing.body)) {
    throw new Error("tasks cannot be assigned to a folder");
  }
}

export async function listTaskLists(opts?: { includeClosed?: boolean }): Promise<TaskListRow[]> {
  const worldId = defaultTaskWorldId();
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
    const item_count = is_folder ? 0 : await countItemsForList(parsed.id);
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

export async function getDefaultTaskList(): Promise<TaskListRow | null> {
  const lists = await listTaskLists({ includeClosed: true });
  return (
    lists.find((l) => l.is_default || l.id === ENTITY_DEFAULT_TASK_LIST_ID) ?? lists[0] ?? null
  );
}

export async function createTaskList(input: TaskListCreateInput): Promise<TaskListRow> {
  const is_folder = input.is_folder ?? false;
  const parent_id = input.parent_id ?? null;

  if (is_folder && parent_id != null) {
    // folders can be nested under other folders
  }
  if (!is_folder && parent_id != null) {
    await assertValidParent(-1, parent_id);
  }
  if (is_folder && parent_id != null) {
    await assertValidParent(-1, parent_id);
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
    world_id: defaultTaskWorldId(),
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

export async function updateTaskList(input: TaskListUpdateInput): Promise<TaskListRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== TASK_LIST_COMPONENT) return null;

  assertDefaultListConstraints(input.id, existing, {
    is_folder: input.is_folder,
    parent_id: input.parent_id,
  });

  if (input.closed === true) {
    assertCanCloseTaskList(input.id, existing);
  }

  if (input.is_folder === false && resolveIsFolder(existing.body)) {
    await assertFolderHasNoChildren(input.id);
  }

  if (input.parent_id !== undefined) {
    await assertValidParent(input.id, input.parent_id);
  }

  const bodyPatch: Record<string, unknown> = {};
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.closed !== undefined) bodyPatch.closed = input.closed;
  if (input.color !== undefined) bodyPatch.color = input.color;
  if (input.is_folder !== undefined) bodyPatch.is_folder = input.is_folder;
  if (input.parent_id !== undefined) bodyPatch.parent_id = input.parent_id;

  const row = await updateEntity({
    id: input.id,
    title: input.name?.trim(),
    body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
  });
  if (!row) return null;

  if (input.closed !== undefined && resolveIsFolder(existing.body)) {
    await cascadeClosedState(input.id, input.closed);
  }

  const parsed = asTaskList(row);
  if (!parsed) return null;
  const is_folder = parsed.is_folder ?? false;
  const item_count = is_folder ? 0 : await countItemsForList(parsed.id);
  return toListRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count,
  });
}

export async function deleteTaskList(id: number, opts?: { cascade?: boolean }): Promise<boolean> {
  if (isDefaultTaskListId(id)) {
    throw new Error("default task list cannot be deleted");
  }
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== TASK_LIST_COMPONENT) return false;
  if (existing.body.is_default === true) {
    throw new Error("default task list cannot be deleted");
  }

  const children = await getChildListIds(id);
  for (const childId of children) {
    await deleteTaskList(childId, { cascade: true });
  }

  if (opts?.cascade !== false) {
    if (!resolveIsFolder(existing.body)) {
      await deleteTasksInList(id);
    }
  }

  return deleteEntity(id);
}

export async function closeTaskList(id: number): Promise<TaskListRow | null> {
  return updateTaskList({ id, closed: true });
}

export async function reopenTaskList(id: number): Promise<TaskListRow | null> {
  return updateTaskList({ id, closed: false });
}

export async function searchTaskLists(opts: TaskListSearchOpts): Promise<TaskListRow[]> {
  const result = await searchEntities({
    world_id: defaultTaskWorldId(),
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
    const item_count = is_folder ? 0 : await countItemsForList(parsed.id);
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
