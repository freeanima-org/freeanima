import {
  DIARY_ENTRY_COMPONENT,
  asDiaryEntry,
  type DiaryEntryBody,
  type DiaryEntrySearchFilters,
} from "@freeanima/host/core/db/schema/entity";
import { formatCstIso, omitUndefined } from "@freeanima/host/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { ensureDiaryEntryForDay as ensureDiaryEntryForDayCore } from "@freeanima/host/core/db/pg/diary";
import { ensureTagsByTitles } from "@freeanima/features/tag/domain";

import {
  createDiaryTextBlock,
  deleteAllDiaryTextBlocks,
  listDiaryTextBlocks,
  searchDiaryParentIdsByBlockText,
} from "./text-blocks.ts";
import type {
  DiaryEntryAppendByDateInput,
  DiaryEntryAppendInput,
  DiaryEntryCreateInput,
  DiaryEntryListOpts,
  DiaryEntryRow,
  DiaryEntrySearchOpts,
  DiaryEntryUpdateByDateInput,
  DiaryEntryUpdateInput,
  DiaryStoreContext,
  DiaryTextBlock,
} from "./types.ts";

function toEntryRow(
  row: NonNullable<ReturnType<typeof asDiaryEntry>>,
  meta: { created_at: Date; updated_at: Date; tag_ids?: number[] },
  blocks: DiaryTextBlock[],
): DiaryEntryRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    entry_at: row.entry_at,
    tag_ids: [...(meta.tag_ids ?? [])],
    blocks,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

function sortByEntryAtDesc(a: DiaryEntryRow, b: DiaryEntryRow): number {
  const at = Date.parse(a.entry_at);
  const bt = Date.parse(b.entry_at);
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
  return b.id - a.id;
}

export function entryDayKey(entryAt: string): string {
  return entryAt.trim().slice(0, 10);
}

/** 同 world 按 CST 日 ensure diary；无则建空壳 */
export async function ensureDiaryEntryForDay(
  ctx: DiaryStoreContext,
  day: string,
): Promise<DiaryEntryRow> {
  const ensured = await ensureDiaryEntryForDayCore(ctx.worldId, day);
  const existing = await getDiaryEntry(ctx, ensured.id);
  if (!existing) throw new Error(`diary entry missing after ensure: ${ensured.id}`);
  return existing;
}

function dayRangeFilters(day: string): { entry_after: string; entry_before: string } {
  return {
    entry_after: `${day}T00:00:00+08:00`,
    entry_before: `${day}T23:59:59+08:00`,
  };
}

export async function findDiaryEntryByDay(
  ctx: DiaryStoreContext,
  entryAt: string,
): Promise<DiaryEntryRow | null> {
  const day = entryDayKey(entryAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const items = await listDiaryEntries(ctx, {
    ...dayRangeFilters(day),
    limit: 20,
  });
  const hit = items.find((row) => entryDayKey(row.entry_at) === day);
  if (!hit) return null;
  return getDiaryEntry(ctx, hit.id);
}

function assertDiaryEntryInWorld(
  existing: Awaited<ReturnType<typeof getEntity>>,
  ctx: DiaryStoreContext,
): existing is NonNullable<typeof existing> {
  if (!existing || existing.primary_component !== DIARY_ENTRY_COMPONENT) return false;
  return existing.world_id === ctx.worldId;
}

export async function listDiaryEntries(
  ctx: DiaryStoreContext,
  opts: DiaryEntryListOpts = {},
): Promise<DiaryEntryRow[]> {
  const filters: DiaryEntrySearchFilters = {};
  if (opts.entry_after) filters.entry_after = opts.entry_after;
  if (opts.entry_before) filters.entry_before = opts.entry_before;

  const tagIds = opts.tag_ids?.length ? opts.tag_ids : undefined;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: DIARY_ENTRY_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(tagIds ? { tag_ids: tagIds } : {}),
    limit: opts.limit ?? 20,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  const items = result.results
    .map((row) => {
      const parsed = asDiaryEntry(row);
      return parsed
        ? toEntryRow(
            parsed,
            { created_at: row.created_at, updated_at: row.updated_at, tag_ids: row.tag_ids },
            [],
          )
        : null;
    })
    .filter((row): row is DiaryEntryRow => row != null);

  return items.toSorted(sortByEntryAtDesc);
}

export async function getDiaryEntry(
  ctx: DiaryStoreContext,
  id: number,
): Promise<DiaryEntryRow | null> {
  const existing = await getEntity(id);
  if (!assertDiaryEntryInWorld(existing, ctx)) return null;
  const parsed = asDiaryEntry(existing);
  if (!parsed) return null;
  const blocks = await listDiaryTextBlocks(ctx, id);
  return toEntryRow(
    parsed,
    {
      created_at: existing.created_at,
      updated_at: existing.updated_at,
      tag_ids: existing.tag_ids,
    },
    blocks,
  );
}

async function findDiaryEntryByClientOpId(
  ctx: DiaryStoreContext,
  clientOpId: string,
): Promise<DiaryEntryRow | null> {
  const filters: DiaryEntrySearchFilters = { client_op_id: clientOpId };
  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: DIARY_ENTRY_COMPONENT,
    filters,
    limit: 1,
    mode: "filter_only",
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asDiaryEntry(row);
  if (!parsed) return null;
  const blocks = await listDiaryTextBlocks(ctx, parsed.id);
  return toEntryRow(
    parsed,
    { created_at: row.created_at, updated_at: row.updated_at, tag_ids: row.tag_ids },
    blocks,
  );
}

async function resolveCreateTagIds(
  worldId: number,
  input: { tag_ids?: number[]; tags?: string[] },
): Promise<number[]> {
  const parts: number[][] = [];
  if (input.tag_ids?.length) parts.push(input.tag_ids);
  if (input.tags?.length) parts.push(await ensureTagsByTitles(worldId, input.tags));
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    for (const id of part) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export async function createDiaryEntry(
  ctx: DiaryStoreContext,
  input: DiaryEntryCreateInput,
): Promise<DiaryEntryRow> {
  if (input.client_op_id) {
    const existing = await findDiaryEntryByClientOpId(ctx, input.client_op_id);
    if (existing) return existing;
  }

  const entryAt = input.entry_at.trim();
  if (!entryAt) throw new Error("entry_at is required");

  const existing = await findDiaryEntryByDay(ctx, entryAt);
  if (existing) {
    throw new Error(`diary entry already exists for ${entryDayKey(entryAt)}`);
  }

  const tagIds = await resolveCreateTagIds(ctx.worldId, input);
  const body: DiaryEntryBody = {
    entry_at: entryAt,
    client_op_id: input.client_op_id ?? null,
  };

  const row = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    components: [DIARY_ENTRY_COMPONENT],
    primary_component: DIARY_ENTRY_COMPONENT,
    title: input.title.trim(),
    summary: input.summary?.trim() ?? "",
    content: "",
    tag_ids: tagIds,
    body,
  });

  const parsed = asDiaryEntry(row);
  if (!parsed) throw new Error("diary entry create failed");

  const initialContent = input.content?.trim() ?? "";
  const blocks: DiaryTextBlock[] = [];
  if (initialContent) {
    blocks.push(
      await createDiaryTextBlock(ctx, {
        parent_id: parsed.id,
        content: initialContent,
        sort_order: 0,
      }),
    );
  }

  return toEntryRow(
    parsed,
    { created_at: row.created_at, updated_at: row.updated_at, tag_ids: row.tag_ids },
    blocks,
  );
}

export async function updateDiaryEntry(
  ctx: DiaryStoreContext,
  input: DiaryEntryUpdateInput,
): Promise<DiaryEntryRow | null> {
  const existing = await getEntity(input.id);
  if (!assertDiaryEntryInWorld(existing, ctx)) return null;

  const bodyPatch: Record<string, unknown> = {};
  if (input.entry_at !== undefined) {
    const nextEntryAt = input.entry_at.trim();
    const conflict = await findDiaryEntryByDay(ctx, nextEntryAt);
    if (conflict && conflict.id !== input.id) {
      throw new Error(`diary entry already exists for ${entryDayKey(nextEntryAt)}`);
    }
    bodyPatch.entry_at = nextEntryAt;
  }

  let nextTagIds: number[] | undefined;
  if (input.tag_ids !== undefined || input.tags !== undefined) {
    nextTagIds = await resolveCreateTagIds(
      ctx.worldId,
      omitUndefined({
        tag_ids: input.tag_ids,
        tags: input.tags,
      }),
    );
  }

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      summary: input.summary?.trim(),
      tag_ids: nextTagIds,
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;

  const parsed = asDiaryEntry(row);
  if (!parsed) return null;
  const blocks = await listDiaryTextBlocks(ctx, input.id);
  return toEntryRow(
    parsed,
    { created_at: row.created_at, updated_at: row.updated_at, tag_ids: row.tag_ids },
    blocks,
  );
}

export async function appendDiaryEntry(
  ctx: DiaryStoreContext,
  input: DiaryEntryAppendInput,
): Promise<DiaryEntryRow | null> {
  const fragment = input.content.trim();
  if (!fragment) throw new Error("content is required");

  const existing = await getEntity(input.id);
  if (!assertDiaryEntryInWorld(existing, ctx)) return null;

  const parsedExisting = asDiaryEntry(existing);
  if (!parsedExisting) return null;

  await createDiaryTextBlock(
    ctx,
    omitUndefined({
      parent_id: input.id,
      content: fragment,
      client_op_id: input.client_op_id,
    }),
  );

  return getDiaryEntry(ctx, input.id);
}

export async function deleteDiaryEntry(ctx: DiaryStoreContext, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!assertDiaryEntryInWorld(existing, ctx)) return false;
  await deleteAllDiaryTextBlocks(ctx, id);
  return deleteEntity(id);
}

export async function searchDiaryEntries(
  ctx: DiaryStoreContext,
  opts: DiaryEntrySearchOpts,
): Promise<DiaryEntryRow[]> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 30));
  const parentIds = await searchDiaryParentIdsByBlockText(ctx, opts.query, limit);
  if (parentIds.length === 0) return [];

  const filters: DiaryEntrySearchFilters = {};
  if (opts.entry_after) filters.entry_after = opts.entry_after;
  if (opts.entry_before) filters.entry_before = opts.entry_before;

  const tagIds = opts.tag_ids?.length ? opts.tag_ids : undefined;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: DIARY_ENTRY_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(tagIds ? { tag_ids: tagIds } : {}),
    limit: 500,
    mode: "filter_only",
  });

  const byId = new Map<
    number,
    {
      parsed: NonNullable<ReturnType<typeof asDiaryEntry>>;
      created_at: Date;
      updated_at: Date;
      tag_ids: number[];
    }
  >();
  for (const row of result.results) {
    const parsed = asDiaryEntry(row);
    if (!parsed) continue;
    byId.set(parsed.id, {
      parsed,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tag_ids: row.tag_ids ?? [],
    });
  }

  return parentIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .map(({ parsed, created_at, updated_at, tag_ids }) =>
      toEntryRow(parsed, { created_at, updated_at, tag_ids }, []),
    );
}

export function titleFromEntryAt(entryAt: string): string {
  const date = new Date(entryAt);
  if (Number.isNaN(date.getTime())) return entryAt.slice(0, 10);
  return date.toLocaleDateString("zh-CN");
}

/** 缺省 entry_at 为当日 CST 正午（日记按日） */
export function defaultEntryAtIso(): string {
  const iso = formatCstIso(new Date());
  const day = iso.slice(0, 10);
  return `${day}T12:00:00+08:00`;
}

/** 工具/SAP 共用：空 → 今天；YYYY-MM-DD 或 ISO → CST 正午 entry_at */
export function parseDiaryDate(raw?: string | null): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return defaultEntryAtIso();
  const dayMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (dayMatch) return `${dayMatch[1]}T12:00:00+08:00`;
  if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return `${trimmed.slice(0, 10)}T12:00:00+08:00`;
  }
  throw new Error(`invalid diary date: ${trimmed}`);
}

export async function getDiaryEntryByDate(
  ctx: DiaryStoreContext,
  date?: string | null,
): Promise<DiaryEntryRow | null> {
  const entryAt = parseDiaryDate(date);
  return findDiaryEntryByDay(ctx, entryAt);
}

export async function appendDiaryEntryByDate(
  ctx: DiaryStoreContext,
  input: DiaryEntryAppendByDateInput,
): Promise<DiaryEntryRow> {
  const fragment = input.content.trim();
  if (!fragment) throw new Error("content is required");

  const entryAt = parseDiaryDate(input.date);
  let existing = await findDiaryEntryByDay(ctx, entryAt);
  if (!existing) {
    existing = await createDiaryEntry(
      ctx,
      omitUndefined({
        title: titleFromEntryAt(entryAt),
        entry_at: entryAt,
        tags: input.tags,
        tag_ids: input.tag_ids,
      }),
    );
  }

  const appended = await appendDiaryEntry(ctx, { id: existing.id, content: fragment });
  if (!appended) throw new Error(`diary append failed for date ${entryDayKey(entryAt)}`);
  return appended;
}

export async function updateDiaryEntryByDate(
  ctx: DiaryStoreContext,
  input: DiaryEntryUpdateByDateInput,
): Promise<DiaryEntryRow | null> {
  const entryAt = parseDiaryDate(input.date);
  const existing = await findDiaryEntryByDay(ctx, entryAt);
  if (!existing) return null;

  return updateDiaryEntry(
    ctx,
    omitUndefined({
      id: existing.id,
      title: input.title,
      summary: input.summary,
      tags: input.tags,
      tag_ids: input.tag_ids,
    }),
  );
}

export async function deleteDiaryEntryByDate(
  ctx: DiaryStoreContext,
  date?: string | null,
): Promise<boolean> {
  const entryAt = parseDiaryDate(date);
  const existing = await findDiaryEntryByDay(ctx, entryAt);
  if (!existing) return false;
  return deleteDiaryEntry(ctx, existing.id);
}
