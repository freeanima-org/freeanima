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
  return {
    id: row.id,
    name: row.name,
    sort_order: row.sort_order ?? 0,
    closed: row.closed ?? false,
    color: row.color ?? null,
    is_default: row.is_default ?? false,
    item_count: meta.item_count,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

export function isDefaultTaskListId(id: number): boolean {
  return id === ENTITY_DEFAULT_TASK_LIST_ID;
}

export async function listTaskLists(): Promise<TaskListRow[]> {
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
  const body: TaskListBody = {
    sort_order: input.sort_order ?? 0,
    closed: false,
    color: input.color ?? null,
    is_default: false,
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

  const bodyPatch: Record<string, unknown> = {};
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.closed !== undefined) bodyPatch.closed = input.closed;
  if (input.color !== undefined) bodyPatch.color = input.color;

  const row = await updateEntity({
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
  const existing = await getEntity(id);
  if (existing?.body.is_default === true) {
    throw new Error("default task list cannot be deleted");
  }
  if (opts?.cascade) {
    const items = await listEntities({
      world_id: defaultTaskWorldId(),
      primary_component: "task_item",
      limit: 500,
    });
    for (const item of items) {
      if (Number(item.body.list_id) === id) {
        await deleteEntity(item.id);
      }
    }
  }
  return deleteEntity(id);
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
