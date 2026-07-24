import {
  TASK_ITEM_COMPONENT,
  TAG_COMPONENT,
  asTaskItem,
  asProject,
  PROJECT_COMPONENT,
  TASK_LIST_COMPONENT,
  type EntityRow,
} from "@freeanima/host/core/db/schema/entity";
import { assertEntityInWorld, assertSameWorldReferent } from "@freeanima/host/core/db/pg/entity";
import { formatCstIso, omitUndefined } from "@freeanima/host/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";

import { assertListAcceptsTasks, assertTaskListNotArchived } from "./list-store.ts";
import { nextPrependSortOrder } from "./sort-order.ts";
import type {
  TaskItemCreateInput,
  TaskItemListOpts,
  TaskItemRow,
  TaskItemSearchOpts,
  TaskItemUpdateInput,
} from "./types.ts";

async function assertProjectActiveForTask(projectId: number, worldId: number): Promise<void> {
  const row = await getEntity(projectId);
  if (!row || row.primary_component !== PROJECT_COMPONENT) {
    throw new Error("project not found");
  }
  await assertEntityInWorld(projectId, worldId);
  const parsed = asProject(row);
  if (!parsed) throw new Error("project not found");
  if (parsed.status === "on_hold") {
    throw new Error("project is on hold");
  }
}

function normalizeTagIds(tagIds: number[] | undefined): number[] {
  if (!tagIds?.length) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of tagIds) {
    const id = Math.floor(Number(raw));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function assertTagIdsInWorld(worldId: number, tagIds: number[]): Promise<void> {
  for (const id of tagIds) {
    const row = await getEntity(id);
    if (!row || row.primary_component !== TAG_COMPONENT) {
      throw new Error(`tag not found: ${id}`);
    }
    await assertEntityInWorld(id, worldId);
  }
}

function toItemRow(entity: EntityRow): TaskItemRow {
  const row = asTaskItem(entity);
  if (!row) throw new Error("invalid task_item row");
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tag_ids: [...(entity.tag_ids ?? [])],
    status: row.status,
    priority: row.priority,
    due_at: row.due_at ?? null,
    remind_at: row.remind_at ?? null,
    list_id: row.list_id ?? null,
    project_id: row.project_id ?? null,
    sort_order: row.sort_order ?? 0,
    completed_at: row.completed_at ?? null,
    created_at: entity.created_at.toISOString(),
    updated_at: entity.updated_at.toISOString(),
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
    if (opts.tag_ids?.length) filters.tag_ids = opts.tag_ids;
    if (opts.project_id != null) filters.project_id = opts.project_id;
    else if (opts.in_backlog !== false) filters.in_backlog = true;
  } else if (opts.filters.project_id == null && opts.filters.in_backlog !== false) {
    filters.in_backlog = true;
  }

  const topLevelTagIds =
    opts.tag_ids ?? (opts.filters?.tag_ids?.length ? opts.filters.tag_ids : undefined);

  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(topLevelTagIds?.length ? { tag_ids: topLevelTagIds } : {}),
    limit: opts.limit ?? 500,
    offset: opts.offset ?? 0,
    mode: "filter_only",
    include_count: false,
  });

  return result.results
    .map((row) => {
      try {
        return toItemRow(row);
      } catch {
        return null;
      }
    })
    .filter((row): row is TaskItemRow => row != null)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

async function findTaskItemByClientOpId(
  worldId: number,
  clientOpId: string,
): Promise<TaskItemRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  try {
    return toItemRow(row);
  } catch {
    return null;
  }
}

export async function createTaskItem(
  worldId: number,
  input: TaskItemCreateInput,
): Promise<TaskItemRow> {
  if (input.client_op_id) {
    const existing = await findTaskItemByClientOpId(worldId, input.client_op_id);
    if (existing) return existing;
  }

  const hasList = input.list_id != null;
  const hasProject = input.project_id != null;
  if (hasList === hasProject) {
    throw new Error("exactly one of list_id or project_id required");
  }

  if (input.list_id != null) {
    await assertListAcceptsTasks(input.list_id, worldId);
  }
  if (input.project_id != null) {
    await assertProjectActiveForTask(input.project_id, worldId);
  }
  const tagIds = normalizeTagIds(input.tag_ids);
  await assertTagIdsInWorld(worldId, tagIds);
  const listId = hasProject ? null : (input.list_id as number);
  const projectId = hasProject ? (input.project_id as number) : null;

  // 未显式传 sort_order：min(pending)-STEP（允许负值），只写新行；拖拽有空隙时也只改一项。
  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const siblings = await listTaskItems(worldId, {
      ...(listId != null ? { list_id: listId } : {}),
      ...(projectId != null ? { project_id: projectId } : {}),
      status: "pending",
    });
    sortOrder = nextPrependSortOrder(siblings.map((s) => s.sort_order));
  }

  const body = {
    status: "pending" as const,
    priority: input.priority ?? "none",
    list_id: listId,
    sort_order: sortOrder,
    tags: [] as string[],
    due_at: input.due_at ?? null,
    remind_at: input.remind_at ?? null,
    completed_at: null,
    client_op_id: input.client_op_id ?? null,
    project_id: projectId,
  };

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [TASK_ITEM_COMPONENT],
    primary_component: TASK_ITEM_COMPONENT,
    title: input.title.trim(),
    content: input.content?.trim() ?? "",
    body,
    tag_ids: tagIds,
  });

  if (!asTaskItem(row)) throw new Error("task item create failed");
  return toItemRow(row);
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

  if (input.list_id != null && input.project_id != null) {
    throw new Error("list_id and project_id are mutually exclusive");
  }

  const inProject = parsedExisting.project_id != null;
  if (!inProject && parsedExisting.list_id != null) {
    await assertTaskListNotArchived(parsedExisting.list_id, worldId);
  }

  const bodyPatch: Record<string, unknown> = {};
  if (input.list_id !== undefined) {
    if (input.list_id == null) {
      throw new Error("list_id cannot be cleared without project_id");
    }
    await assertListAcceptsTasks(input.list_id, worldId);
    await assertSameWorldReferent(input.id, input.list_id);
    bodyPatch.list_id = input.list_id;
    bodyPatch.project_id = null;
  }
  if (input.project_id !== undefined) {
    if (input.project_id != null) {
      await assertProjectActiveForTask(input.project_id, worldId);
      await assertSameWorldReferent(input.id, input.project_id);
      bodyPatch.project_id = input.project_id;
      bodyPatch.list_id = null;
    } else if (input.list_id === undefined) {
      throw new Error("list_id required when leaving project");
    } else {
      bodyPatch.project_id = null;
    }
  }
  if (input.priority !== undefined) bodyPatch.priority = input.priority;
  if (input.due_at !== undefined) bodyPatch.due_at = input.due_at;
  if (input.remind_at !== undefined) bodyPatch.remind_at = input.remind_at;
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.status !== undefined) {
    bodyPatch.status = input.status;
    bodyPatch.completed_at = input.status === "completed" ? formatCstIso(new Date()) : null;
  }

  let nextTagIds: number[] | undefined;
  if (input.tag_ids !== undefined) {
    nextTagIds = normalizeTagIds(input.tag_ids);
    await assertTagIdsInWorld(worldId, nextTagIds);
  }

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title,
      content: input.content,
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
      tag_ids: nextTagIds,
    }),
  );
  if (!row) return null;

  try {
    return toItemRow(row);
  } catch {
    return null;
  }
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
  if (parsed && parsed.project_id == null && parsed.list_id != null) {
    await assertTaskListNotArchived(parsed.list_id, worldId);
  }
  return deleteEntity(id);
}

async function resolveEntityTitle(
  id: number,
  primary: string,
  cache: Map<number, string>,
): Promise<string | null> {
  const cached = cache.get(id);
  if (cached) return cached;
  const row = await getEntity(id);
  if (!row || row.primary_component !== primary) return null;
  const title = row.title.trim() || `#${id}`;
  cache.set(id, title);
  return title;
}

export async function enrichTaskItemsWithAttribution(rows: TaskItemRow[]): Promise<TaskItemRow[]> {
  if (rows.length === 0) return rows;
  const projectCache = new Map<number, string>();
  const listCache = new Map<number, string>();
  const enriched: TaskItemRow[] = [];
  for (const row of rows) {
    const project_title =
      row.project_id != null
        ? await resolveEntityTitle(row.project_id, PROJECT_COMPONENT, projectCache)
        : null;
    const list_name =
      row.list_id != null
        ? await resolveEntityTitle(row.list_id, TASK_LIST_COMPONENT, listCache)
        : null;
    enriched.push({
      ...row,
      project_title,
      list_name,
    });
  }
  return enriched;
}

export async function searchTaskItems(
  worldId: number,
  opts: TaskItemSearchOpts,
): Promise<TaskItemRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.list_id != null) filters.list_id = opts.list_id;
  if (opts.project_id != null) filters.project_id = opts.project_id;
  if (opts.status != null && opts.status !== "all") filters.status = opts.status;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    query: opts.query,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: Math.max(1, Math.min(50, opts.limit ?? 30)),
    mode: "hybrid",
    include_count: false,
  });

  const rows = result.results
    .map((row) => {
      try {
        return toItemRow(row);
      } catch {
        return null;
      }
    })
    .filter((row): row is TaskItemRow => row != null);
  return enrichTaskItemsWithAttribution(rows);
}
