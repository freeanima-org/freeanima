import {
  OBJECTIVE_COMPONENT,
  asObjective,
  type ObjectiveBody,
  type ObjectiveCompletion,
  type ObjectiveLink,
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
import { asRecord } from "@freeanima/shared/util";

import { assertCompletionSupported, resolveObjectiveProgress } from "./resolve-progress.ts";
import type {
  ObjectiveCreateInput,
  ObjectiveListOpts,
  ObjectiveRow,
  ObjectiveUpdateInput,
} from "./types.ts";

const ACTIVE_STATUSES = new Set(["not_started", "in_progress"]);

function resolveParentId(body: unknown): number | null {
  const v = asRecord(body)?.parent_id;
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

function toObjectiveRow(
  row: NonNullable<ReturnType<typeof asObjective>>,
  meta: { created_at: Date; updated_at: Date },
  resolved_progress?: ObjectiveRow["resolved_progress"],
): ObjectiveRow {
  return omitUndefined({
    id: row.id,
    title: row.title,
    content: row.content,
    parent_id: row.parent_id ?? null,
    status: row.status,
    start_at: row.start_at ?? null,
    end_at: row.end_at ?? null,
    completion: row.completion,
    links: row.links ?? [],
    sort_order: row.sort_order ?? 0,
    resolved_progress,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  });
}

async function withProgress(
  worldId: number,
  parsed: NonNullable<ReturnType<typeof asObjective>>,
  meta: { created_at: Date; updated_at: Date },
): Promise<ObjectiveRow> {
  const resolved_progress = await resolveObjectiveProgress(worldId, parsed);
  return toObjectiveRow(parsed, meta, resolved_progress);
}

async function assertNoCycle(childId: number, parentId: number, worldId: number): Promise<void> {
  let current: number | null = parentId;
  const visited = new Set<number>();
  while (current != null) {
    if (current === childId) {
      throw new Error("目标嵌套会形成环");
    }
    if (visited.has(current)) break;
    visited.add(current);
    const row = await getEntity(current);
    if (!row || row.primary_component !== OBJECTIVE_COMPONENT) break;
    await assertEntityInWorld(current, worldId);
    current = resolveParentId(row.body);
  }
}

async function assertValidParent(
  childId: number | null,
  parentId: number | null,
  worldId: number,
): Promise<void> {
  if (parentId == null) return;
  if (childId != null && parentId === childId) {
    throw new Error("目标不能以自身为父级");
  }
  const parent = await getEntity(parentId);
  if (!parent || parent.primary_component !== OBJECTIVE_COMPONENT) {
    throw new Error("父目标不存在");
  }
  await assertEntityInWorld(parentId, worldId);
  if (childId != null) {
    await assertNoCycle(childId, parentId, worldId);
  }
}

function defaultCompletion(): ObjectiveCompletion {
  return { kind: "qualitative" };
}

function buildBody(input: {
  parent_id: number | null;
  status: ObjectiveBody["status"];
  start_at: string | null;
  end_at: string | null;
  completion: ObjectiveCompletion;
  links: ObjectiveLink[];
  sort_order: number;
  client_op_id: string | null;
}): ObjectiveBody {
  return {
    parent_id: input.parent_id,
    status: input.status,
    start_at: input.start_at,
    end_at: input.end_at,
    completion: input.completion,
    links: input.links,
    sort_order: input.sort_order,
    client_op_id: input.client_op_id,
  };
}

async function findByClientOpId(worldId: number, clientOpId: string): Promise<ObjectiveRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: OBJECTIVE_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asObjective(row);
  if (!parsed) return null;
  return withProgress(worldId, parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export async function listObjectives(
  worldId: number,
  opts: ObjectiveListOpts = {},
): Promise<ObjectiveRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: OBJECTIVE_COMPONENT,
    limit: 1000,
  });
  const out: ObjectiveRow[] = [];
  for (const row of rows) {
    const parsed = asObjective(row);
    if (!parsed) continue;
    if (opts.parent_id !== undefined && (parsed.parent_id ?? null) !== opts.parent_id) continue;
    if (opts.status != null && parsed.status !== opts.status) continue;
    if (!opts.include_inactive && opts.status == null && !ACTIVE_STATUSES.has(parsed.status)) {
      continue;
    }
    out.push(
      await withProgress(worldId, parsed, {
        created_at: row.created_at,
        updated_at: row.updated_at,
      }),
    );
  }
  return out.toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function getObjective(worldId: number, id: number): Promise<ObjectiveRow | null> {
  const row = await getEntity(id);
  if (!row || row.primary_component !== OBJECTIVE_COMPONENT) return null;
  if (row.world_id !== worldId) return null;
  const parsed = asObjective(row);
  if (!parsed) return null;
  return withProgress(worldId, parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export async function createObjective(
  worldId: number,
  input: ObjectiveCreateInput,
): Promise<ObjectiveRow> {
  if (input.client_op_id) {
    const existing = await findByClientOpId(worldId, input.client_op_id);
    if (existing) return existing;
  }

  const completion = input.completion ?? defaultCompletion();
  assertCompletionSupported(completion);
  const parent_id = input.parent_id ?? null;
  await assertValidParent(null, parent_id, worldId);
  if (parent_id != null) {
    // parent already asserted in world
  }

  const body = buildBody({
    parent_id,
    status: input.status ?? "not_started",
    start_at: input.start_at ?? null,
    end_at: input.end_at ?? null,
    completion,
    links: input.links ?? [],
    sort_order: input.sort_order ?? 0,
    client_op_id: input.client_op_id ?? null,
  });

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [OBJECTIVE_COMPONENT],
    primary_component: OBJECTIVE_COMPONENT,
    title: input.title.trim(),
    summary: "",
    content: input.content?.trim() ?? "",
    body,
  });
  const parsed = asObjective(row);
  if (!parsed) throw new Error("objective create parse failed");
  return withProgress(worldId, parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export async function updateObjective(
  worldId: number,
  input: ObjectiveUpdateInput,
): Promise<ObjectiveRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== OBJECTIVE_COMPONENT) return null;
  if (existing.world_id !== worldId) return null;
  const current = asObjective(existing);
  if (!current) return null;

  if (input.parent_id !== undefined) {
    await assertValidParent(input.id, input.parent_id, worldId);
    if (input.parent_id != null) {
      await assertSameWorldReferent(input.id, input.parent_id);
    }
  }

  const completion = input.completion ?? current.completion;
  assertCompletionSupported(completion);

  const body = buildBody({
    parent_id: input.parent_id !== undefined ? input.parent_id : (current.parent_id ?? null),
    status: input.status ?? current.status,
    start_at: input.start_at !== undefined ? input.start_at : (current.start_at ?? null),
    end_at: input.end_at !== undefined ? input.end_at : (current.end_at ?? null),
    completion,
    links: input.links !== undefined ? input.links : (current.links ?? []),
    sort_order: input.sort_order !== undefined ? input.sort_order : (current.sort_order ?? 0),
    client_op_id:
      input.client_op_id !== undefined ? input.client_op_id : (current.client_op_id ?? null),
  });

  const updated = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title !== undefined ? input.title.trim() : undefined,
      content: input.content !== undefined ? input.content : undefined,
      body,
    }),
  );
  if (!updated) return null;
  const parsed = asObjective(updated);
  if (!parsed) return null;
  return withProgress(worldId, parsed, {
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  });
}

async function collectDescendantIds(rootId: number, worldId: number): Promise<number[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: OBJECTIVE_COMPONENT,
    limit: 1000,
  });
  const childrenByParent = new Map<number | null, number[]>();
  for (const row of rows) {
    const parsed = asObjective(row);
    if (!parsed) continue;
    const pid = parsed.parent_id ?? null;
    const list = childrenByParent.get(pid) ?? [];
    list.push(parsed.id);
    childrenByParent.set(pid, list);
  }
  const out: number[] = [];
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id == null) continue;
    out.push(id);
    const kids = childrenByParent.get(id) ?? [];
    for (const kid of kids) stack.push(kid);
  }
  return out;
}

export async function deleteObjective(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== OBJECTIVE_COMPONENT) return false;
  if (existing.world_id !== worldId) return false;
  await assertEntityInWorld(id, worldId);
  const ids = await collectDescendantIds(id, worldId);
  // 先删子再删根（软删顺序无关，但保持一致性）
  for (const childId of ids.toReversed()) {
    await deleteEntity(childId);
  }
  return true;
}

export async function linkObjective(
  worldId: number,
  id: number,
  link: ObjectiveLink,
): Promise<ObjectiveRow | null> {
  const current = await getObjective(worldId, id);
  if (!current) return null;
  const exists = current.links.some((l) => l.kind === link.kind && l.id === link.id);
  if (exists) return current;
  return updateObjective(worldId, {
    id,
    links: [...current.links, link],
  });
}

export async function unlinkObjective(
  worldId: number,
  id: number,
  link: ObjectiveLink,
): Promise<ObjectiveRow | null> {
  const current = await getObjective(worldId, id);
  if (!current) return null;
  const links = current.links.filter((l) => !(l.kind === link.kind && l.id === link.id));
  return updateObjective(worldId, { id, links });
}
