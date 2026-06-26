import {
  TASK_ITEM_COMPONENT,
  asTaskItem,
  type TaskItemBody,
} from "@freeanima/core/db/schema/entity";
import { formatCstIso } from "@freeanima/core/util";

import { defaultTaskWorldId, getEntityStoreForTask } from "./entity-port.ts";
import type {
  TaskItemCreateInput,
  TaskItemListOpts,
  TaskItemRow,
  TaskItemUpdateInput,
} from "./types.ts";

function toItemRow(
  row: NonNullable<ReturnType<typeof asTaskItem>>,
  meta: { created_at: string; updated_at: string },
): TaskItemRow {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    due_at: row.due_at ?? null,
    list_id: row.list_id,
    sort_order: row.sort_order ?? 0,
    note: row.note ?? null,
    completed_at: row.completed_at ?? null,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
  };
}

function isDueToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export async function listTaskItems(opts: TaskItemListOpts = {}): Promise<TaskItemRow[]> {
  const store = getEntityStoreForTask();
  const rows = await store.list({
    world_id: defaultTaskWorldId(),
    primary_component: TASK_ITEM_COMPONENT,
    limit: opts.limit ?? 500,
    offset: opts.offset ?? 0,
  });

  let items = rows
    .map((row) => {
      const parsed = asTaskItem(row);
      return parsed
        ? toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is TaskItemRow => row != null);

  if (opts.list_id != null) {
    items = items.filter((item) => item.list_id === opts.list_id);
  }
  if (opts.status && opts.status !== "all") {
    items = items.filter((item) => item.status === opts.status);
  }
  if (opts.due_today) {
    items = items.filter((item) => isDueToday(item.due_at));
  }

  return items.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function createTaskItem(input: TaskItemCreateInput): Promise<TaskItemRow> {
  const store = getEntityStoreForTask();
  const list = await store.get(input.list_id);
  if (!list || list.primary_component !== "task_list") {
    throw new Error(`task list not found: ${input.list_id}`);
  }

  const body: TaskItemBody = {
    title: input.title.trim(),
    status: "pending",
    priority: input.priority ?? "none",
    due_at: input.due_at ?? null,
    list_id: input.list_id,
    sort_order: input.sort_order ?? 0,
    note: input.note ?? null,
    completed_at: null,
  };

  const row = await store.create({
    type: "content",
    world_id: defaultTaskWorldId(),
    components: [TASK_ITEM_COMPONENT],
    primary_component: TASK_ITEM_COMPONENT,
    body,
  });
  const parsed = asTaskItem(row);
  if (!parsed) throw new Error("failed to create task item");
  return toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function updateTaskItem(input: TaskItemUpdateInput): Promise<TaskItemRow | null> {
  const store = getEntityStoreForTask();
  const existing = await store.get(input.id);
  if (!existing || existing.primary_component !== TASK_ITEM_COMPONENT) return null;

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.list_id !== undefined) patch.list_id = input.list_id;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.due_at !== undefined) patch.due_at = input.due_at;
  if (input.note !== undefined) patch.note = input.note;
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.completed_at = input.status === "completed" ? formatCstIso(new Date()) : null;
  }

  const row = await store.update({ id: input.id, body: patch });
  if (!row) return null;
  const parsed = asTaskItem(row);
  return parsed
    ? toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

export async function completeTaskItem(id: number): Promise<TaskItemRow | null> {
  return updateTaskItem({
    id,
    status: "completed",
  });
}

export async function uncompleteTaskItem(id: number): Promise<TaskItemRow | null> {
  return updateTaskItem({
    id,
    status: "pending",
  });
}

export async function deleteTaskItem(id: number): Promise<boolean> {
  return getEntityStoreForTask().delete(id);
}
