import {
  DIARY_ENTRY_COMPONENT,
  asDiaryEntry,
  type DiaryEntryBody,
} from "@freeanima/core/db/schema/entity";
import { formatCstIso, omitUndefined } from "@freeanima/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/core/db/pg/entity";

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
} from "./types.ts";

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

function toEntryRow(
  row: NonNullable<ReturnType<typeof asDiaryEntry>>,
  meta: { created_at: Date; updated_at: Date },
): DiaryEntryRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    entry_at: row.entry_at,
    tags: row.tags ?? [],
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
  return items.find((row) => entryDayKey(row.entry_at) === day) ?? null;
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
  const filters: Record<string, unknown> = {};
  if (opts.entry_after) filters.entry_after = opts.entry_after;
  if (opts.entry_before) filters.entry_before = opts.entry_before;
  if (opts.tags?.length) filters.tags = opts.tags;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: DIARY_ENTRY_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: opts.limit ?? 500,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  return result.results
    .map((row) => {
      const parsed = asDiaryEntry(row);
      return parsed
        ? toEntryRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is DiaryEntryRow => row != null)
    .toSorted(sortByEntryAtDesc);
}

export async function getDiaryEntry(
  ctx: DiaryStoreContext,
  id: number,
): Promise<DiaryEntryRow | null> {
  const existing = await getEntity(id);
  if (!assertDiaryEntryInWorld(existing, ctx)) return null;
  const parsed = asDiaryEntry(existing);
  return parsed
    ? toEntryRow(parsed, { created_at: existing.created_at, updated_at: existing.updated_at })
    : null;
}

export async function createDiaryEntry(
  ctx: DiaryStoreContext,
  input: DiaryEntryCreateInput,
): Promise<DiaryEntryRow> {
  const entryAt = input.entry_at.trim();
  if (!entryAt) throw new Error("entry_at is required");

  const existing = await findDiaryEntryByDay(ctx, entryAt);
  if (existing) {
    throw new Error(`diary entry already exists for ${entryDayKey(entryAt)}`);
  }

  const body: DiaryEntryBody = {
    entry_at: entryAt,
    tags: normalizeTags(input.tags),
  };

  const row = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    components: [DIARY_ENTRY_COMPONENT],
    primary_component: DIARY_ENTRY_COMPONENT,
    title: input.title.trim(),
    summary: input.summary?.trim() ?? "",
    content: input.content?.trim() ?? "",
    body,
  });

  const parsed = asDiaryEntry(row);
  if (!parsed) throw new Error("diary entry create failed");
  return toEntryRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
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
  if (input.tags !== undefined) bodyPatch.tags = normalizeTags(input.tags);

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      summary: input.summary?.trim(),
      content: input.content,
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;

  const parsed = asDiaryEntry(row);
  return parsed
    ? toEntryRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
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

  const nextContent = parsedExisting.content.trim()
    ? `${parsedExisting.content.trim()}\n\n${fragment}`
    : fragment;

  const row = await updateEntity({
    id: input.id,
    content: nextContent,
  });
  if (!row) return null;

  const parsed = asDiaryEntry(row);
  return parsed
    ? toEntryRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

export async function deleteDiaryEntry(ctx: DiaryStoreContext, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!assertDiaryEntryInWorld(existing, ctx)) return false;
  return deleteEntity(id);
}

export async function searchDiaryEntries(
  ctx: DiaryStoreContext,
  opts: DiaryEntrySearchOpts,
): Promise<DiaryEntryRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.entry_after) filters.entry_after = opts.entry_after;
  if (opts.entry_before) filters.entry_before = opts.entry_before;
  if (opts.tags?.length) filters.tags = opts.tags;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: DIARY_ENTRY_COMPONENT,
    query: opts.query,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: Math.max(1, Math.min(50, opts.limit ?? 30)),
    mode: "hybrid",
  });

  return result.results
    .map((row) => {
      const parsed = asDiaryEntry(row);
      return parsed
        ? toEntryRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
        : null;
    })
    .filter((row): row is DiaryEntryRow => row != null);
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
        content: "",
        tags: input.tags,
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
      content: input.content,
      summary: input.summary,
      tags: input.tags,
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
