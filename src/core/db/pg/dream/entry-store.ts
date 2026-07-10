import {
  DREAM_ENTRY_COMPONENT,
  asDreamEntry,
  type DreamEntryBody,
} from "@freeanima/core/db/schema/entity";
import {
  createEntity,
  countEntities,
  getEntity,
  searchEntities,
} from "@freeanima/core/db/pg/entity";

import type {
  DreamEntryCreateInput,
  DreamEntryListOpts,
  DreamEntryRow,
  DreamStoreContext,
} from "./types.ts";

function normalizeStringArray(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  return raw.map((s) => s.trim()).filter(Boolean);
}

function toDreamRow(
  row: NonNullable<ReturnType<typeof asDreamEntry>>,
  meta: { created_at: Date },
): DreamEntryRow {
  return {
    id: row.id,
    dream_day: row.dream_day,
    content: row.content,
    source_limbic_ids: row.source_limbic_ids ?? [],
    source_conversation_ids: row.source_conversation_ids ?? [],
    episodic_snippets: row.episodic_snippets ?? [],
    ...(row.legacy_id !== undefined ? { legacy_id: row.legacy_id } : {}),
    created_at: meta.created_at.toISOString(),
  };
}

function sortByCreatedAtDesc(a: DreamEntryRow, b: DreamEntryRow): number {
  const at = Date.parse(a.created_at);
  const bt = Date.parse(b.created_at);
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
  return b.id - a.id;
}

export async function getDreamEntryByDay(
  ctx: DreamStoreContext,
  day: string,
): Promise<DreamEntryRow | null> {
  const dream_day = day.trim();
  if (!dream_day) return null;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: DREAM_ENTRY_COMPONENT,
    filters: { dream_day },
    limit: 1,
    mode: "filter_only",
  });

  const row = result.results[0];
  if (!row) return null;
  const parsed = asDreamEntry(row);
  return parsed ? toDreamRow(parsed, { created_at: row.created_at }) : null;
}

export async function getLatestDreamEntry(ctx: DreamStoreContext): Promise<DreamEntryRow | null> {
  const items = await listDreamEntries(ctx, { limit: 1 });
  return items[0] ?? null;
}

export async function listDreamEntries(
  ctx: DreamStoreContext,
  opts: DreamEntryListOpts = {},
): Promise<DreamEntryRow[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 20));
  const offset = Math.max(0, opts.offset ?? 0);

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: DREAM_ENTRY_COMPONENT,
    limit,
    offset,
    mode: "filter_only",
  });

  return result.results
    .map((row) => {
      const parsed = asDreamEntry(row);
      return parsed ? toDreamRow(parsed, { created_at: row.created_at }) : null;
    })
    .filter((row): row is DreamEntryRow => row != null)
    .toSorted(sortByCreatedAtDesc);
}

export async function countDreamEntries(ctx: DreamStoreContext): Promise<number> {
  return countEntities({
    world_id: ctx.worldId,
    primary_component: DREAM_ENTRY_COMPONENT,
  });
}

export async function createDreamEntry(
  ctx: DreamStoreContext,
  input: DreamEntryCreateInput,
): Promise<DreamEntryRow> {
  const dream_day = input.dream_day.trim();
  const content = input.content.trim();
  if (!dream_day) throw new Error("dream_day is required");
  if (!content) throw new Error("content is required");

  const existing = await getDreamEntryByDay(ctx, dream_day);
  if (existing) {
    throw new Error(`dream already exists for ${dream_day}`);
  }

  const body: DreamEntryBody = {
    dream_day,
    source_limbic_ids: normalizeStringArray(input.source_limbic_ids),
    source_conversation_ids: normalizeStringArray(input.source_conversation_ids),
    episodic_snippets: input.episodic_snippets ?? [],
  };

  const row = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    components: [DREAM_ENTRY_COMPONENT],
    primary_component: DREAM_ENTRY_COMPONENT,
    title: dream_day,
    summary: "",
    content,
    body,
  });

  const parsed = asDreamEntry(row);
  if (!parsed) throw new Error("dream entry create failed");
  return toDreamRow(parsed, { created_at: row.created_at });
}

export async function getDreamEntry(
  ctx: DreamStoreContext,
  id: number,
): Promise<DreamEntryRow | null> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== DREAM_ENTRY_COMPONENT) return null;
  if (existing.world_id !== ctx.worldId) return null;
  const parsed = asDreamEntry(existing);
  return parsed ? toDreamRow(parsed, { created_at: existing.created_at }) : null;
}
