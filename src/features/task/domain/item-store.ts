import {
  TASK_ITEM_COMPONENT,
  asTaskItem,
  asMilestone,
  asProject,
  MILESTONE_COMPONENT,
  PROJECT_COMPONENT,
  TASK_LIST_COMPONENT,
} from "@freeanima/core/db/schema/entity";
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

async function assertMilestoneInProjectForTask(
  milestoneId: number,
  projectId: number,
  worldId: number,
): Promise<void> {
  const row = await getEntity(milestoneId);
  if (!row || row.primary_component !== MILESTONE_COMPONENT) {
    throw new Error("milestone not found");
  }
  await assertEntityInWorld(milestoneId, worldId);
  const parsed = asMilestone(row);
  if (!parsed || parsed.project_id !== projectId) {
    throw new Error("milestone does not belong to project");
  }
}

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
    project_id: row.project_id ?? null,
    milestone_id: row.milestone_id ?? null,
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
    if (opts.project_id != null) filters.project_id = opts.project_id;
    else if (opts.in_backlog !== false) filters.in_backlog = true;
  } else if (opts.filters.project_id == null && opts.filters.in_backlog !== false) {
    filters.in_backlog = true;
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
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asTaskItem(row);
  if (!parsed) return null;
  return toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function createTaskItem(
  worldId: number,
  input: TaskItemCreateInput,
): Promise<TaskItemRow> {
  if (input.client_op_id) {
    const existing = await findTaskItemByClientOpId(worldId, input.client_op_id);
    if (existing) return existing;
  }

  await assertListAcceptsTasks(input.list_id, worldId);
  if (input.project_id != null) {
    await assertProjectActiveForTask(input.project_id, worldId);
    if (input.milestone_id != null) {
      await assertMilestoneInProjectForTask(input.milestone_id, input.project_id, worldId);
    }
  }
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
    client_op_id: input.client_op_id ?? null,
    ...(input.project_id != null ? { project_id: input.project_id } : {}),
    ...(input.milestone_id != null ? { milestone_id: input.milestone_id } : {}),
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

  const inProject = parsedExisting.project_id != null;
  if (!inProject) {
    await assertTaskListNotArchived(parsedExisting.list_id, worldId);
  }

  const bodyPatch: Record<string, unknown> = {};
  if (input.list_id !== undefined) {
    await assertListAcceptsTasks(input.list_id, worldId);
    await assertSameWorldReferent(input.id, input.list_id);
    bodyPatch.list_id = input.list_id;
  }
  if (input.project_id !== undefined) {
    if (input.project_id != null) {
      await assertProjectActiveForTask(input.project_id, worldId);
      await assertSameWorldReferent(input.id, input.project_id);
      bodyPatch.project_id = input.project_id;
    } else {
      bodyPatch.project_id = null;
      bodyPatch.milestone_id = null;
    }
  }
  if (input.milestone_id !== undefined) {
    const projectId =
      input.project_id !== undefined ? input.project_id : (parsedExisting.project_id ?? null);
    if (input.milestone_id != null) {
      if (projectId == null) {
        throw new Error("milestone requires project_id");
      }
      await assertMilestoneInProjectForTask(input.milestone_id, projectId, worldId);
      bodyPatch.milestone_id = input.milestone_id;
    } else {
      bodyPatch.milestone_id = null;
    }
  }
  if (
    input.project_id !== undefined &&
    input.project_id != null &&
    input.project_id !== parsedExisting.project_id
  ) {
    bodyPatch.milestone_id = null;
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
  if (parsed && parsed.project_id == null) {
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
    const list_name = await resolveEntityTitle(row.list_id, TASK_LIST_COMPONENT, listCache);
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
  if (opts.status != null && opts.status !== "all") filters.status = opts.status;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    query: opts.query,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: Math.max(1, Math.min(50, opts.limit ?? 30)),
    mode: "hybrid",
  });

  const rows = result.results
    .map((row) => {
      const parsed = asTaskItem(row);
      return parsed
        ? toItemRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is TaskItemRow => row != null);
  return enrichTaskItemsWithAttribution(rows);
}
