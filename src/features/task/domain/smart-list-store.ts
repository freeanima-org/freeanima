import { SMART_LIST_COMPONENT, asSmartList } from "@freeanima/host/core/db/schema/entity";
import type { TaskItemSearchFilters } from "@freeanima/host/core/db/schema";
import { assertEntityInWorld } from "@freeanima/host/core/db/pg/entity";
import { omitUndefined } from "@freeanima/host/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";

import { listBuiltinSmartListRows } from "./smart-list-presets.ts";
import type { SmartListRow } from "./types.ts";

export type SmartListCreateInput = {
  title: string;
  filters: TaskItemSearchFilters;
  sort_order?: number;
};

export type SmartListUpdateInput = {
  id: number;
  title?: string;
  filters?: TaskItemSearchFilters;
  sort_order?: number;
};

function toCustomRow(
  parsed: NonNullable<ReturnType<typeof asSmartList>>,
  meta: { created_at: Date; updated_at: Date },
): SmartListRow {
  return {
    id: parsed.id,
    title: parsed.title,
    sort_order: parsed.sort_order ?? 0,
    filters: parsed.filters,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

export async function listCustomSmartLists(worldId: number): Promise<SmartListRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: SMART_LIST_COMPONENT,
    limit: 200,
  });
  const lists: SmartListRow[] = [];
  for (const row of rows) {
    const parsed = asSmartList(row);
    if (!parsed) continue;
    lists.push(toCustomRow(parsed, { created_at: row.created_at, updated_at: row.updated_at }));
  }
  return lists.toSorted((a, b) => a.sort_order - b.sort_order || (a.id ?? 0) - (b.id ?? 0));
}

export async function createSmartList(
  worldId: number,
  input: SmartListCreateInput,
): Promise<SmartListRow> {
  const custom = await listCustomSmartLists(worldId);
  const body = {
    sort_order: input.sort_order ?? custom.length,
    filters: input.filters,
  };
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [SMART_LIST_COMPONENT],
    primary_component: SMART_LIST_COMPONENT,
    title: input.title.trim(),
    body,
  });
  const parsed = asSmartList(row);
  if (!parsed) throw new Error("smart list create failed");
  return toCustomRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function updateSmartList(
  worldId: number,
  input: SmartListUpdateInput,
): Promise<SmartListRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== SMART_LIST_COMPONENT) return null;
  await assertEntityInWorld(input.id, worldId);

  const parsedExisting = asSmartList(existing);
  if (!parsedExisting) return null;

  const bodyPatch: Record<string, unknown> = {};
  if (input.filters !== undefined) bodyPatch.filters = input.filters;
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;

  const parsed = asSmartList(row);
  return parsed
    ? toCustomRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

export async function deleteSmartList(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== SMART_LIST_COMPONENT) return false;
  await assertEntityInWorld(id, worldId);
  return deleteEntity(id);
}

/** 同步列出内置 + 自定义（自定义为 async） */
export async function listSmartListsMerged(worldId: number): Promise<SmartListRow[]> {
  const custom = await listCustomSmartLists(worldId);
  const builtin = listBuiltinSmartListRows();
  const customBaseOrder = builtin.length;
  return [
    ...builtin,
    ...custom.map((row, index) => ({
      ...row,
      sort_order: row.sort_order ?? customBaseOrder + index,
    })),
  ].toSorted(
    (a, b) =>
      a.sort_order - b.sort_order ||
      ("id" in a && a.id != null ? a.id : 0) - ("id" in b && b.id != null ? b.id : 0),
  );
}
