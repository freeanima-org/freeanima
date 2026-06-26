import {
  ENTITY_DEFAULT_TASK_LIST_ID,
  TASK_LIST_COMPONENT,
  asTaskList,
  type TaskListBody,
} from "@freeanima/core/db/schema/entity";

import { defaultTaskWorldId, getEntityStoreForTask } from "./entity-port.ts";
import type { TaskListCreateInput, TaskListRow, TaskListUpdateInput } from "./types.ts";

async function countItemsForList(listId: number): Promise<number> {
  const store = getEntityStoreForTask();
  const items = await store.list({
    world_id: defaultTaskWorldId(),
    primary_component: "task_item",
    limit: 500,
  });
  return items.filter((item) => Number(item.body.list_id) === listId).length;
}

function toListRow(
  row: NonNullable<ReturnType<typeof asTaskList>>,
  meta: { created_at: string; updated_at: string; item_count: number },
): TaskListRow {
  return {
    id: row.id,
    name: row.name,
    sort_order: row.sort_order ?? 0,
    closed: row.closed ?? false,
    color: row.color ?? null,
    is_default: row.is_default ?? false,
    item_count: meta.item_count,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
  };
}

export function isDefaultTaskListId(id: number): boolean {
  return id === ENTITY_DEFAULT_TASK_LIST_ID;
}

export async function listTaskLists(): Promise<TaskListRow[]> {
  const store = getEntityStoreForTask();
  const worldId = defaultTaskWorldId();
  const rows = await store.list({
    world_id: worldId,
    primary_component: TASK_LIST_COMPONENT,
    limit: 200,
  });
  const lists: TaskListRow[] = [];
  for (const row of rows) {
    const parsed = asTaskList(row);
    if (!parsed) continue;
    const item_count = await countItemsForList(parsed.id);
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
  const lists = await listTaskLists();
  return (
    lists.find((l) => l.is_default || l.id === ENTITY_DEFAULT_TASK_LIST_ID) ?? lists[0] ?? null
  );
}

export async function createTaskList(input: TaskListCreateInput): Promise<TaskListRow> {
  const store = getEntityStoreForTask();
  const body: TaskListBody = {
    sort_order: input.sort_order ?? 0,
    closed: false,
    color: input.color ?? null,
    is_default: false,
  };
  const row = await store.create({
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
  const store = getEntityStoreForTask();
  const existing = await store.get(input.id);
  if (!existing || existing.primary_component !== TASK_LIST_COMPONENT) return null;

  const bodyPatch: Record<string, unknown> = {};
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.closed !== undefined) bodyPatch.closed = input.closed;
  if (input.color !== undefined) bodyPatch.color = input.color;

  const row = await store.update({
    id: input.id,
    title: input.name?.trim(),
    body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
  });
  if (!row) return null;
  const parsed = asTaskList(row);
  if (!parsed) return null;
  const item_count = await countItemsForList(parsed.id);
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
  const store = getEntityStoreForTask();
  const existing = await store.get(id);
  if (existing?.body.is_default === true) {
    throw new Error("default task list cannot be deleted");
  }
  if (opts?.cascade) {
    const items = await store.list({
      world_id: defaultTaskWorldId(),
      primary_component: "task_item",
      limit: 500,
    });
    for (const item of items) {
      if (Number(item.body.list_id) === id) {
        await store.delete(item.id);
      }
    }
  }
  return store.delete(id);
}
