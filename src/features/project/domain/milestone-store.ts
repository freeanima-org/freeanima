import {
  MILESTONE_COMPONENT,
  PROJECT_COMPONENT,
  asMilestone,
} from "@freeanima/core/db/schema/entity";
import { assertEntityInWorld, assertSameWorldReferent } from "@freeanima/core/db/pg/entity";
import { omitUndefined } from "@freeanima/core/util";
import {
  clearTaskItemMilestoneId,
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  searchEntities,
  updateEntity,
} from "@freeanima/core/db/pg/entity";

import { assertProjectActive } from "./project-store.ts";
import type { MilestoneCreateInput, MilestoneRow, MilestoneUpdateInput } from "./types.ts";

function resolveMilestoneStatus(
  dueAt: string,
  status: "pending" | "in_progress" | "completed" | "delayed",
): "pending" | "in_progress" | "completed" | "delayed" {
  if (status === "completed") return "completed";
  const due = new Date(dueAt);
  if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) {
    return "delayed";
  }
  return status;
}

function toMilestoneRow(
  row: NonNullable<ReturnType<typeof asMilestone>>,
  meta: { created_at: Date; updated_at: Date },
): MilestoneRow {
  const status = resolveMilestoneStatus(row.due_at, row.status);
  return {
    id: row.id,
    title: row.title,
    project_id: row.project_id,
    due_at: row.due_at,
    status,
    sort_order: row.sort_order ?? 0,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

async function clearTaskMilestoneRefs(worldId: number, milestoneId: number): Promise<void> {
  await clearTaskItemMilestoneId(worldId, milestoneId);
}

export async function listMilestones(worldId: number, projectId: number): Promise<MilestoneRow[]> {
  const project = await getEntity(projectId);
  if (!project || project.primary_component !== PROJECT_COMPONENT) {
    throw new Error("project not found");
  }
  await assertEntityInWorld(projectId, worldId);

  const rows = await listEntities({
    world_id: worldId,
    primary_component: MILESTONE_COMPONENT,
    limit: 500,
  });
  return rows
    .map((row) => {
      const parsed = asMilestone(row);
      if (!parsed || parsed.project_id !== projectId) return null;
      return toMilestoneRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
    })
    .filter((row): row is MilestoneRow => row != null)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

async function findMilestoneByClientOpId(
  worldId: number,
  clientOpId: string,
): Promise<MilestoneRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: MILESTONE_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asMilestone(row);
  if (!parsed) return null;
  return toMilestoneRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function createMilestone(
  worldId: number,
  input: MilestoneCreateInput,
): Promise<MilestoneRow> {
  if (input.client_op_id) {
    const existing = await findMilestoneByClientOpId(worldId, input.client_op_id);
    if (existing) return existing;
  }
  await assertProjectActive(input.project_id, worldId);
  await assertSameWorldReferent(input.project_id, input.project_id);
  const existing = await listMilestones(worldId, input.project_id);
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [MILESTONE_COMPONENT],
    primary_component: MILESTONE_COMPONENT,
    title: input.title.trim(),
    body: {
      project_id: input.project_id,
      due_at: input.due_at,
      status: "pending" as const,
      sort_order: input.sort_order ?? existing.length,
      client_op_id: input.client_op_id ?? null,
    },
  });
  const parsed = asMilestone(row);
  if (!parsed) throw new Error("milestone create failed");
  return toMilestoneRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function updateMilestone(
  worldId: number,
  input: MilestoneUpdateInput,
): Promise<MilestoneRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== MILESTONE_COMPONENT) return null;
  await assertEntityInWorld(input.id, worldId);
  const parsedExisting = asMilestone(existing);
  if (!parsedExisting) return null;

  const bodyPatch: Record<string, unknown> = {};
  if (input.due_at !== undefined) bodyPatch.due_at = input.due_at;
  if (input.status !== undefined) bodyPatch.status = input.status;
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;
  const parsed = asMilestone(row);
  return parsed
    ? toMilestoneRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

export async function deleteMilestone(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== MILESTONE_COMPONENT) return false;
  await assertEntityInWorld(id, worldId);
  await clearTaskMilestoneRefs(worldId, id);
  return deleteEntity(id);
}

export async function assertMilestoneInProject(
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
