import { TASK_ITEM_COMPONENT, asTaskItem } from "@freeanima/core/db/schema/entity";
import { assertEntityInWorld, assertSameWorldReferent } from "@freeanima/core/db/pg/entity";
import { formatCstIso, omitUndefined } from "@freeanima/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/core/db/pg/entity";

import { assertListAcceptsTasks, assertTaskListNotArchived } from "./list-store.ts";
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

export async function listTaskItems(
  worldId: number,
  opts: TaskItemListOpts = {},
): Promise<TaskItemRow[]> {
  const filters: Record<string, unknown> = opts.filters != null ? { ...opts.filters } : {};

  if (opts.filters == null) {
    if (opts.list_id != null) filters.list_id = opts.list_id;
    if (opts.status != null) filters.status = opts.status;
    if (opts.due_today) filters.due_today = true;
    if (opts.tags?.length) filters.tags = opts.tags;
  }

  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
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

export async function createTaskItem(
  worldId: number,
  input: TaskItemCreateInput,
): Promise<TaskItemRow> {
  await assertListAcceptsTasks(input.list_id, worldId);
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
    world_id: worldId,
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

export async function updateTaskItem(
  worldId: number,
  input: TaskItemUpdateInput,
): Promise<TaskItemRow | null> {
  const existing = await getEntity(input.id);
  if (!existing) return null;
  await assertEntityInWorld(input.id, worldId);

  const parsedExisting = asTaskItem(existing);
  if (!parsedExisting) return null;

  await assertTaskListNotArchived(parsedExisting.list_id, worldId);

  const bodyPatch: Record<string, unknown> = {};
  if (input.list_id !== undefined) {
    await assertListAcceptsTasks(input.list_id, worldId);
    await assertSameWorldReferent(input.id, input.list_id);
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

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title,
      content: input.content,
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;

  const parsed = asTaskItem(row);
  return parsed
    ? toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

export async function completeTaskItem(worldId: number, id: number): Promise<TaskItemRow | null> {
  return updateTaskItem(worldId, { id, status: "completed" });
}

export async function uncompleteTaskItem(worldId: number, id: number): Promise<TaskItemRow | null> {
  return updateTaskItem(worldId, { id, status: "pending" });
}

export async function deleteTaskItem(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing) return false;
  await assertEntityInWorld(id, worldId);
  const parsed = asTaskItem(existing);
  if (parsed) {
    await assertTaskListNotArchived(parsed.list_id, worldId);
  }
  return deleteEntity(id);
}

export async function searchTaskItems(
  worldId: number,
  opts: TaskItemSearchOpts,
): Promise<TaskItemRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.list_id != null) filters.list_id = opts.list_id;
  if (opts.status != null && opts.status !== "all") filters.status = opts.status;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    query: opts.query,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
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
    .filter((row): row is TaskItemRow => row != null);
}
