import { TASK_ITEM_COMPONENT, asTaskItem } from "@freeanima/core/db/schema/entity";
import { formatCstIso } from "@freeanima/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/core/db/pg/entity";

import { defaultTaskWorldId, assertListAcceptsTasks } from "./list-store.ts";
import type {
  TaskItemCreateInput,
  TaskItemListOpts,
  TaskItemRow,
  TaskItemSearchOpts,
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
  meta: { created_at: Date; updated_at: Date },
): TaskItemRow {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    status: row.status,
    priority: row.priority,
    due_at: row.due_at ?? null,
    remind_at: row.remind_at ?? null,
    list_id: row.list_id,
    sort_order: row.sort_order ?? 0,
    completed_at: row.completed_at ?? null,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

export async function listTaskItems(opts: TaskItemListOpts = {}): Promise<TaskItemRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.list_id != null) filters.list_id = opts.list_id;
  if (opts.status != null) filters.status = opts.status;
  if (opts.due_today) filters.due_today = true;
  if (opts.tags?.length) filters.tags = opts.tags;

  const result = await searchEntities({
    world_id: defaultTaskWorldId(),
    primary_component: TASK_ITEM_COMPONENT,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    limit: opts.limit ?? 500,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  return result.results
    .map((row) => {
      const parsed = asTaskItem(row);
      return parsed
        ? toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is TaskItemRow => row != null)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function createTaskItem(input: TaskItemCreateInput): Promise<TaskItemRow> {
  await assertListAcceptsTasks(input.list_id);
  const tags = normalizeTags(input.tags);
  const body = {
    status: "pending" as const,
    priority: input.priority ?? "none",
    list_id: input.list_id,
    sort_order: input.sort_order ?? 0,
    tags,
    due_at: input.due_at ?? null,
    remind_at: input.remind_at ?? null,
    completed_at: null,
  };

  const row = await createEntity({
    type: "content",
    world_id: defaultTaskWorldId(),
    components: [TASK_ITEM_COMPONENT],
    primary_component: TASK_ITEM_COMPONENT,
    title: input.title.trim(),
    content: input.content?.trim() ?? "",
    body,
  });

  const parsed = asTaskItem(row);
  if (!parsed) throw new Error("task item create failed");
  return toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function updateTaskItem(input: TaskItemUpdateInput): Promise<TaskItemRow | null> {
  const existing = await getEntity(input.id);
  if (!existing) return null;

  const parsedExisting = asTaskItem(existing);
  if (!parsedExisting) return null;

  const bodyPatch: Record<string, unknown> = {};
  if (input.list_id !== undefined) {
    await assertListAcceptsTasks(input.list_id);
    bodyPatch.list_id = input.list_id;
  }
  if (input.priority !== undefined) bodyPatch.priority = input.priority;
  if (input.due_at !== undefined) bodyPatch.due_at = input.due_at;
  if (input.remind_at !== undefined) bodyPatch.remind_at = input.remind_at;
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.tags !== undefined) bodyPatch.tags = normalizeTags(input.tags);
  if (input.status !== undefined) {
    bodyPatch.status = input.status;
    bodyPatch.completed_at = input.status === "completed" ? formatCstIso(new Date()) : null;
  }

  const row = await updateEntity({
    id: input.id,
    title: input.title,
    content: input.content,
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
  return deleteEntity(id);
}

export async function searchTaskItems(opts: TaskItemSearchOpts): Promise<TaskItemRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.list_id != null) filters.list_id = opts.list_id;
  if (opts.status != null && opts.status !== "all") filters.status = opts.status;

  const result = await searchEntities({
    world_id: defaultTaskWorldId(),
    primary_component: TASK_ITEM_COMPONENT,
    query: opts.query,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    limit: Math.max(1, Math.min(50, opts.limit ?? 30)),
    mode: "hybrid",
  });

  return result.results
    .map((row) => {
      const parsed = asTaskItem(row);
      return parsed
        ? toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is TaskItemRow => row != null)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}
