import {
  MILESTONE_COMPONENT,
  PROJECT_COMPONENT,
  TASK_ITEM_COMPONENT,
  asProject,
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

import { assertProjectFolderExists } from "./folder-store.ts";
import type {
  ProjectCreateInput,
  ProjectListOpts,
  ProjectRow,
  ProjectUpdateInput,
} from "./types.ts";

async function countTasksForProject(projectId: number, worldId: number): Promise<number> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    filters: { project_id: projectId },
    limit: 500,
    mode: "filter_only",
  });
  return result.results.length;
}

async function countMilestonesForProject(projectId: number, worldId: number): Promise<number> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: MILESTONE_COMPONENT,
    limit: 500,
  });
  return rows.filter((row) => Number(row.body.project_id) === projectId).length;
}

function toProjectRow(
  row: NonNullable<ReturnType<typeof asProject>>,
  meta: {
    created_at: Date;
    updated_at: Date;
    task_count: number;
    milestone_count: number;
  },
): ProjectRow {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    folder_id: row.folder_id ?? null,
    start_at: row.start_at,
    end_at: row.end_at,
    completion_criteria: row.completion_criteria ?? row.content,
    status: row.status,
    product_tag: row.product_tag ?? null,
    sort_order: row.sort_order ?? 0,
    linked_diary_ids: row.linked_diary_ids ?? [],
    task_count: meta.task_count,
    milestone_count: meta.milestone_count,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

export async function releaseTasksFromProject(worldId: number, projectId: number): Promise<void> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    filters: { project_id: projectId },
    limit: 500,
    mode: "filter_only",
  });
  for (const row of result.results) {
    await updateEntity({
      id: row.id,
      body: { project_id: null, milestone_id: null },
    });
  }
}

async function clearMilestoneRefs(worldId: number, milestoneId: number): Promise<void> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    limit: 500,
    mode: "filter_only",
  });
  for (const row of result.results) {
    if (Number(row.body.milestone_id) !== milestoneId) continue;
    await updateEntity({
      id: row.id,
      body: { milestone_id: null },
    });
  }
}

export async function deleteMilestonesForProject(
  worldId: number,
  projectId: number,
): Promise<void> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: MILESTONE_COMPONENT,
    limit: 500,
  });
  for (const row of rows) {
    if (Number(row.body.project_id) !== projectId) continue;
    await clearMilestoneRefs(worldId, row.id);
    await deleteEntity(row.id);
  }
}

export async function listProjects(
  worldId: number,
  opts: ProjectListOpts = {},
): Promise<ProjectRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: PROJECT_COMPONENT,
    limit: 500,
  });
  const projects: ProjectRow[] = [];
  for (const row of rows) {
    const parsed = asProject(row);
    if (!parsed) continue;
    if (opts.folder_id !== undefined && (parsed.folder_id ?? null) !== opts.folder_id) continue;
    if (opts.status != null && parsed.status !== opts.status) continue;
    const task_count = await countTasksForProject(parsed.id, worldId);
    const milestone_count = await countMilestonesForProject(parsed.id, worldId);
    projects.push(
      toProjectRow(parsed, {
        created_at: row.created_at,
        updated_at: row.updated_at,
        task_count,
        milestone_count,
      }),
    );
  }
  return projects.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function getProject(worldId: number, id: number): Promise<ProjectRow | null> {
  const row = await getEntity(id);
  if (!row) return null;
  await assertEntityInWorld(id, worldId);
  const parsed = asProject(row);
  if (!parsed) return null;
  const task_count = await countTasksForProject(parsed.id, worldId);
  const milestone_count = await countMilestonesForProject(parsed.id, worldId);
  return toProjectRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    task_count,
    milestone_count,
  });
}

export async function createProject(
  worldId: number,
  input: ProjectCreateInput,
): Promise<ProjectRow> {
  if (input.folder_id != null) {
    await assertProjectFolderExists(input.folder_id, worldId);
  }
  const siblings = await listProjects(worldId, { folder_id: input.folder_id ?? null });
  const criteria = input.completion_criteria.trim();
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [PROJECT_COMPONENT],
    primary_component: PROJECT_COMPONENT,
    title: input.title.trim(),
    content: input.content?.trim() ?? criteria,
    body: {
      folder_id: input.folder_id ?? null,
      start_at: input.start_at,
      end_at: input.end_at,
      completion_criteria: criteria,
      status: "active" as const,
      product_tag: input.product_tag,
      sort_order: input.sort_order ?? siblings.length,
      linked_diary_ids: [],
    },
  });
  const parsed = asProject(row);
  if (!parsed) throw new Error("project create failed");
  return toProjectRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    task_count: 0,
    milestone_count: 0,
  });
}

const TERMINAL_STATUSES = new Set(["completed", "cancelled"]);

export async function updateProject(
  worldId: number,
  input: ProjectUpdateInput,
): Promise<ProjectRow | null> {
  const existing = await getEntity(input.id);
  if (!existing) return null;
  await assertEntityInWorld(input.id, worldId);
  const parsedExisting = asProject(existing);
  if (!parsedExisting) return null;

  if (input.folder_id !== undefined && input.folder_id != null) {
    await assertProjectFolderExists(input.folder_id, worldId);
    await assertSameWorldReferent(input.id, input.folder_id);
  }

  const bodyPatch: Record<string, unknown> = {};
  if (input.folder_id !== undefined) bodyPatch.folder_id = input.folder_id;
  if (input.start_at !== undefined) bodyPatch.start_at = input.start_at;
  if (input.end_at !== undefined) bodyPatch.end_at = input.end_at;
  if (input.completion_criteria !== undefined) {
    bodyPatch.completion_criteria = input.completion_criteria;
  }
  if (input.product_tag !== undefined) bodyPatch.product_tag = input.product_tag;
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.status !== undefined) bodyPatch.status = input.status;
  if (input.linked_diary_ids !== undefined) bodyPatch.linked_diary_ids = input.linked_diary_ids;

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      content: input.content?.trim() ?? input.completion_criteria?.trim(),
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;

  const nextStatus = input.status ?? parsedExisting.status;
  const wasTerminal = TERMINAL_STATUSES.has(parsedExisting.status);
  const isTerminal = TERMINAL_STATUSES.has(nextStatus);
  if (!wasTerminal && isTerminal && input.release_tasks !== false) {
    await releaseTasksFromProject(worldId, input.id);
  }

  const parsed = asProject(row);
  if (!parsed) return null;
  const task_count = await countTasksForProject(parsed.id, worldId);
  const milestone_count = await countMilestonesForProject(parsed.id, worldId);
  return toProjectRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    task_count,
    milestone_count,
  });
}

export async function deleteProject(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== PROJECT_COMPONENT) return false;
  await assertEntityInWorld(id, worldId);
  await releaseTasksFromProject(worldId, id);
  await deleteMilestonesForProject(worldId, id);
  return deleteEntity(id);
}

export async function assertProjectActive(projectId: number, worldId: number): Promise<void> {
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
