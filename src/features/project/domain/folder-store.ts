import {
  PROJECT_COMPONENT,
  PROJECT_FOLDER_COMPONENT,
  asProject,
  asProjectFolder,
} from "@freeanima/core/db/schema/entity";
import { assertEntityInWorld, assertSameWorldReferent } from "@freeanima/core/db/pg/entity";
import { omitUndefined } from "@freeanima/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from "@freeanima/core/db/pg/entity";

import type {
  ProjectFolderCreateInput,
  ProjectFolderRow,
  ProjectFolderUpdateInput,
} from "./types.ts";

function resolveParentId(body: Record<string, unknown>): number | null {
  const v = body.parent_id;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toFolderRow(
  row: NonNullable<ReturnType<typeof asProjectFolder>>,
  meta: { created_at: Date; updated_at: Date },
): ProjectFolderRow {
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parent_id ?? null,
    sort_order: row.sort_order ?? 0,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

async function getChildFolderIds(parentId: number, worldId: number): Promise<number[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: PROJECT_FOLDER_COMPONENT,
    limit: 500,
  });
  return rows.filter((row) => resolveParentId(row.body) === parentId).map((row) => row.id);
}

async function assertNoCycle(childId: number, parentId: number, worldId: number): Promise<void> {
  let current: number | null = parentId;
  const visited = new Set<number>();
  while (current != null) {
    if (current === childId) {
      throw new Error("folder nesting would create a cycle");
    }
    if (visited.has(current)) break;
    visited.add(current);
    const row = await getEntity(current);
    if (!row || row.primary_component !== PROJECT_FOLDER_COMPONENT) break;
    await assertEntityInWorld(current, worldId);
    current = resolveParentId(row.body);
  }
}

async function assertValidParent(
  childId: number,
  parentId: number | null,
  worldId: number,
): Promise<void> {
  if (parentId == null) return;
  if (parentId === childId) {
    throw new Error("folder cannot be its own parent");
  }
  const parent = await getEntity(parentId);
  if (!parent || parent.primary_component !== PROJECT_FOLDER_COMPONENT) {
    throw new Error("parent folder not found");
  }
  await assertEntityInWorld(parentId, worldId);
  await assertNoCycle(childId, parentId, worldId);
}

async function dissolveFolderTree(folderId: number, worldId: number): Promise<void> {
  const childFolderIds = await getChildFolderIds(folderId, worldId);
  for (const childId of childFolderIds) {
    await dissolveFolderTree(childId, worldId);
  }

  const projects = await listEntities({
    world_id: worldId,
    primary_component: PROJECT_COMPONENT,
    limit: 500,
  });
  for (const project of projects) {
    const parsed = asProject(project);
    if (!parsed || parsed.folder_id !== folderId) continue;
    await updateEntity({
      id: project.id,
      body: { folder_id: null },
    });
  }

  await deleteEntity(folderId);
}

export async function listProjectFolders(worldId: number): Promise<ProjectFolderRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: PROJECT_FOLDER_COMPONENT,
    limit: 500,
  });
  return rows
    .map((row) => {
      const parsed = asProjectFolder(row);
      return parsed
        ? toFolderRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is ProjectFolderRow => row != null)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function createProjectFolder(
  worldId: number,
  input: ProjectFolderCreateInput,
): Promise<ProjectFolderRow> {
  if (input.parent_id != null) {
    const parent = await getEntity(input.parent_id);
    if (!parent || parent.primary_component !== PROJECT_FOLDER_COMPONENT) {
      throw new Error("parent folder not found");
    }
    await assertEntityInWorld(input.parent_id, worldId);
  }
  const siblings = await listProjectFolders(worldId);
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [PROJECT_FOLDER_COMPONENT],
    primary_component: PROJECT_FOLDER_COMPONENT,
    title: input.name.trim(),
    body: {
      parent_id: input.parent_id ?? null,
      sort_order: input.sort_order ?? siblings.length,
    },
  });
  const parsed = asProjectFolder(row);
  if (!parsed) throw new Error("project folder create failed");
  return toFolderRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function updateProjectFolder(
  worldId: number,
  input: ProjectFolderUpdateInput,
): Promise<ProjectFolderRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== PROJECT_FOLDER_COMPONENT) return null;
  await assertEntityInWorld(input.id, worldId);

  if (input.parent_id !== undefined) {
    await assertValidParent(input.id, input.parent_id, worldId);
    if (input.parent_id != null) {
      await assertSameWorldReferent(input.id, input.parent_id);
    }
  }

  const bodyPatch: Record<string, unknown> = {};
  if (input.parent_id !== undefined) bodyPatch.parent_id = input.parent_id;
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.name?.trim(),
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;
  const parsed = asProjectFolder(row);
  return parsed
    ? toFolderRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

export async function deleteProjectFolder(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== PROJECT_FOLDER_COMPONENT) return false;
  await assertEntityInWorld(id, worldId);
  await dissolveFolderTree(id, worldId);
  return true;
}

export async function assertProjectFolderExists(folderId: number, worldId: number): Promise<void> {
  const folder = await getEntity(folderId);
  if (!folder || folder.primary_component !== PROJECT_FOLDER_COMPONENT) {
    throw new Error("project folder not found");
  }
  await assertEntityInWorld(folderId, worldId);
}
