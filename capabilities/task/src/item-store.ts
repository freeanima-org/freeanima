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

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function toItemRow(
  row: NonNullable<ReturnType<typeof asTaskItem>>,
  meta: { created_at: string; updated_at: string },
): TaskItemRow {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    status: row.status,
    priority: row.priority,
    due_at: row.due_at ?? null,
    list_id: row.list_id,
    sort_order: row.sort_order ?? 0,
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

function matchesTags(itemTags: string[], filter: string[] | undefined): boolean {
  if (!filter?.length) return true;
  const set = new Set(itemTags);
  return filter.every((t) => set.has(t));
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
  if (opts.tags?.length) {
    items = items.filter((item) => matchesTags(item.tags, opts.tags));
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
    status: "pending",
    priority: input.priority ?? "none",
    due_at: input.due_at ?? null,
    list_id: input.list_id,
    sort_order: input.sort_order ?? 0,
    tags: normalizeTags(input.tags),
    completed_at: null,
  };

  const row = await store.create({
    type: "content",
    world_id: defaultTaskWorldId(),
    components: [TASK_ITEM_COMPONENT],
    primary_component: TASK_ITEM_COMPONENT,
    title: input.title.trim(),
    content: input.content?.trim() ?? "",
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

  const bodyPatch: Record<string, unknown> = {};
  if (input.list_id !== undefined) bodyPatch.list_id = input.list_id;
  if (input.priority !== undefined) bodyPatch.priority = input.priority;
  if (input.due_at !== undefined) bodyPatch.due_at = input.due_at;
  if (input.tags !== undefined) bodyPatch.tags = normalizeTags(input.tags);
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.status !== undefined) {
    bodyPatch.status = input.status;
    bodyPatch.completed_at = input.status === "completed" ? formatCstIso(new Date()) : null;
  }

  const row = await store.update({
    id: input.id,
    title: input.title?.trim(),
    content: input.content !== undefined ? input.content.trim() : undefined,
    body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
  });
  if (!row) return null;
  const parsed = asTaskItem(row);
  return parsed
    ? toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

export async function completeTaskItem(id: number): Promise<TaskItemRow | null> {
  return updateTaskItem({ id, status: "completed" });
}

export async function uncompleteTaskItem(id: number): Promise<TaskItemRow | null> {
  return updateTaskItem({ id, status: "pending" });
}

export async function deleteTaskItem(id: number): Promise<boolean> {
  return getEntityStoreForTask().delete(id);
}
