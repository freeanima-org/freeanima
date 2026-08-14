import {
  PROJECT_COMPONENT,
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
  asProject,
  asTaskList,
} from "@freeanima/habitat/core/db/schema/entity";
import { assertEntityInWorld, assertSameWorldReferent } from "@freeanima/habitat/core/db/pg/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";

import { assertProjectFolderExists } from "./folder-store.ts";
import type {
  ProjectCreateInput,
  ProjectListOpts,
  ProjectRow,
  ProjectUpdateInput,
} from "./types.ts";

async function resolveDefaultListId(worldId: number): Promise<number> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: TASK_LIST_COMPONENT,
    limit: 200,
  });
  for (const row of rows) {
    const parsed = asTaskList(row);
    if (!parsed) continue;
    if (parsed.is_default && !parsed.is_folder) return parsed.id;
  }
  for (const row of rows) {
    const parsed = asTaskList(row);
    if (parsed && !parsed.is_folder) return parsed.id;
  }
  throw new Error("default task list not available");
}

function toProjectRow(
  row: NonNullable<ReturnType<typeof asProject>>,
  meta: {
    created_at: Date;
    updated_at: Date;
  },
): ProjectRow {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    folder_id: row.folder_id ?? null,
    start_at: row.start_at,
    end_at: row.end_at,
    status: row.status,
    product_tag: row.product_tag ?? null,
    sort_order: row.sort_order ?? 0,
    linked_diary_ids: row.linked_diary_ids ?? [],
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

export async function releaseTasksFromProject(worldId: number, projectId: number): Promise<void> {
  const defaultListId = await resolveDefaultListId(worldId);
  const result = await searchEntities({
    world_id: worldId,
    component: TASK_ITEM_COMPONENT,
    filters: { project_id: projectId },
    limit: 500,
    mode: "filter_only",
  });
  for (const row of result.results) {
    await updateEntity({
      id: row.id,
      body: { project_id: null, list_id: defaultListId },
    });
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
    projects.push(
      toProjectRow(parsed, {
        created_at: row.created_at,
        updated_at: row.updated_at,
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
  return toProjectRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

async function findProjectByClientOpId(
  worldId: number,
  clientOpId: string,
): Promise<ProjectRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: PROJECT_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asProject(row);
  if (!parsed) return null;
  return toProjectRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export async function createProject(
  worldId: number,
  input: ProjectCreateInput,
): Promise<ProjectRow> {
  if (input.client_op_id) {
    const existing = await findProjectByClientOpId(worldId, input.client_op_id);
    if (existing) return existing;
  }
  if (input.folder_id != null) {
    await assertProjectFolderExists(input.folder_id, worldId);
  }
  const siblings = await listProjects(worldId, { folder_id: input.folder_id ?? null });
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [PROJECT_COMPONENT],
    primary_component: PROJECT_COMPONENT,
    title: input.title.trim(),
    content: input.content?.trim() ?? "",
    body: {
      folder_id: input.folder_id ?? null,
      start_at: input.start_at ?? null,
      end_at: input.end_at ?? null,
      status: "active" as const,
      product_tag: input.product_tag,
      sort_order: input.sort_order ?? siblings.length,
      linked_diary_ids: [],
      client_op_id: input.client_op_id ?? null,
    },
  });
  const parsed = asProject(row);
  if (!parsed) throw new Error("project create failed");
  return toProjectRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
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
  if (input.product_tag !== undefined) bodyPatch.product_tag = input.product_tag;
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.status !== undefined) bodyPatch.status = input.status;
  if (input.linked_diary_ids !== undefined) bodyPatch.linked_diary_ids = input.linked_diary_ids;

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      content: input.content !== undefined ? input.content.trim() : undefined,
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;

  const nextStatus = input.status ?? parsedExisting.status;
  const wasTerminal = TERMINAL_STATUSES.has(parsedExisting.status);
  const isTerminal = TERMINAL_STATUSES.has(nextStatus);
  if (!wasTerminal && isTerminal && input.release_tasks === true) {
    await releaseTasksFromProject(worldId, input.id);
  }

  const parsed = asProject(row);
  if (!parsed) return null;
  return toProjectRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export async function deleteProject(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== PROJECT_COMPONENT) return false;
  await assertEntityInWorld(id, worldId);
  await releaseTasksFromProject(worldId, id);
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
