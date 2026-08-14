import { NOTE_COMPONENT, asNote, type NoteBody } from "@freeanima/habitat/core/db/schema/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";
import { ensureTagsByTitles } from "@freeanima/features/tag/domain";

import {
  createNoteTextBlock,
  deleteAllNoteTextBlocks,
  listNoteTextBlocks,
  searchNoteTextBlockHits,
} from "./text-blocks.ts";
import type {
  NoteAppendInput,
  NoteCreateInput,
  NoteListOpts,
  NoteRow,
  NoteSearchOpts,
  NoteStoreContext,
  NoteTextBlock,
  NoteUpdateInput,
} from "./types.ts";

function toNoteRow(
  row: NonNullable<ReturnType<typeof asNote>>,
  meta: { created_at: Date; updated_at: Date; tag_ids?: number[] },
  blocks: NoteTextBlock[],
): NoteRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    tag_ids: [...(meta.tag_ids ?? [])],
    blocks,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

function sortByUpdatedAtDesc(a: NoteRow, b: NoteRow): number {
  const at = Date.parse(a.updated_at);
  const bt = Date.parse(b.updated_at);
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
  return b.id - a.id;
}

function assertNoteInWorld(
  existing: Awaited<ReturnType<typeof getEntity>>,
  ctx: NoteStoreContext,
): existing is NonNullable<typeof existing> {
  if (!existing || existing.primary_component !== NOTE_COMPONENT) return false;
  return existing.world_id === ctx.worldId;
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

export async function listNotes(
  ctx: NoteStoreContext,
  opts: NoteListOpts = {},
): Promise<NoteRow[]> {
  const tagIds = opts.tag_ids?.length ? opts.tag_ids : undefined;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: NOTE_COMPONENT,
    ...(tagIds ? { tag_ids: tagIds } : {}),
    limit: opts.limit ?? 50,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  const items = result.results
    .map((row) => {
      const parsed = asNote(row);
      return parsed
        ? toNoteRow(
            parsed,
            { created_at: row.created_at, updated_at: row.updated_at, tag_ids: row.tag_ids },
            [],
          )
        : null;
    })
    .filter((row): row is NoteRow => row != null);

  return items.toSorted(sortByUpdatedAtDesc);
}

export async function getNote(ctx: NoteStoreContext, id: number): Promise<NoteRow | null> {
  const existing = await getEntity(id);
  if (!assertNoteInWorld(existing, ctx)) return null;
  const parsed = asNote(existing);
  if (!parsed) return null;
  const blocks = await listNoteTextBlocks(ctx, id);
  return toNoteRow(
    parsed,
    {
      created_at: existing.created_at,
      updated_at: existing.updated_at,
      tag_ids: existing.tag_ids,
    },
    blocks,
  );
}

async function findNoteByClientOpId(
  ctx: NoteStoreContext,
  clientOpId: string,
): Promise<NoteRow | null> {
  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: NOTE_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asNote(row);
  if (!parsed) return null;
  const blocks = await listNoteTextBlocks(ctx, parsed.id);
  return toNoteRow(
    parsed,
    { created_at: row.created_at, updated_at: row.updated_at, tag_ids: row.tag_ids },
    blocks,
  );
}

export async function createNote(ctx: NoteStoreContext, input: NoteCreateInput): Promise<NoteRow> {
  if (input.client_op_id) {
    const existing = await findNoteByClientOpId(ctx, input.client_op_id);
    if (existing) return existing;
  }

  const tagIds = await resolveCreateTagIds(ctx.worldId, input);
  const body: NoteBody = {
    client_op_id: input.client_op_id ?? null,
  };

  const row = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    components: [NOTE_COMPONENT],
    primary_component: NOTE_COMPONENT,
    title: input.title.trim(),
    summary: input.summary?.trim() ?? "",
    content: "",
    tag_ids: tagIds,
    body,
  });

  const parsed = asNote(row);
  if (!parsed) throw new Error("note create failed");

  const initialContent = input.content?.trim() ?? "";
  const blocks: NoteTextBlock[] = [];
  if (initialContent) {
    blocks.push(
      await createNoteTextBlock(ctx, {
        parent_id: parsed.id,
        content: initialContent,
        sort_order: 0,
      }),
    );
  }

  return toNoteRow(
    parsed,
    { created_at: row.created_at, updated_at: row.updated_at, tag_ids: row.tag_ids },
    blocks,
  );
}

export async function updateNote(
  ctx: NoteStoreContext,
  input: NoteUpdateInput,
): Promise<NoteRow | null> {
  const existing = await getEntity(input.id);
  if (!assertNoteInWorld(existing, ctx)) return null;

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
    }),
  );
  if (!row) return null;

  const parsed = asNote(row);
  if (!parsed) return null;
  const blocks = await listNoteTextBlocks(ctx, input.id);
  return toNoteRow(
    parsed,
    { created_at: row.created_at, updated_at: row.updated_at, tag_ids: row.tag_ids },
    blocks,
  );
}

export async function appendNote(
  ctx: NoteStoreContext,
  input: NoteAppendInput,
): Promise<NoteRow | null> {
  const fragment = input.content.trim();
  if (!fragment) throw new Error("content is required");

  const existing = await getEntity(input.id);
  if (!assertNoteInWorld(existing, ctx)) return null;

  const parsedExisting = asNote(existing);
  if (!parsedExisting) return null;

  await createNoteTextBlock(
    ctx,
    omitUndefined({
      parent_id: input.id,
      content: fragment,
      client_op_id: input.client_op_id,
    }),
  );

  return getNote(ctx, input.id);
}

export async function deleteNote(ctx: NoteStoreContext, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!assertNoteInWorld(existing, ctx)) return false;
  await deleteAllNoteTextBlocks(ctx, id);
  return deleteEntity(id);
}

export async function searchNotes(ctx: NoteStoreContext, opts: NoteSearchOpts): Promise<NoteRow[]> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 30));
  const hitGroups = await searchNoteTextBlockHits(ctx, {
    query: opts.query,
    limit,
  });
  if (hitGroups.length === 0) return [];

  const tagIds = opts.tag_ids?.length ? opts.tag_ids : undefined;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: NOTE_COMPONENT,
    ...(tagIds ? { tag_ids: tagIds } : {}),
    limit: 500,
    mode: "filter_only",
  });

  const byId = new Map<
    number,
    {
      parsed: NonNullable<ReturnType<typeof asNote>>;
      created_at: Date;
      updated_at: Date;
      tag_ids: number[];
    }
  >();
  for (const row of result.results) {
    const parsed = asNote(row);
    if (!parsed) continue;
    byId.set(parsed.id, {
      parsed,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tag_ids: row.tag_ids ?? [],
    });
  }

  // 保留 hybrid 命中序（hitGroups 顺序）
  return hitGroups
    .map((group) => {
      const meta = byId.get(group.parentId);
      if (!meta) return null;
      return toNoteRow(
        meta.parsed,
        {
          created_at: meta.created_at,
          updated_at: meta.updated_at,
          tag_ids: meta.tag_ids,
        },
        group.blocks,
      );
    })
    .filter((row): row is NoteRow => row != null);
}
