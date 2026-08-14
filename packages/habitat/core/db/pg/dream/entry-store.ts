import {
  getDreamBrickByDay,
  getLatestDreamBrick,
  getMemoryBrick,
  listBricksByComponent,
  type MemoryBrickRow,
} from "@freeanima/habitat/core/db/pg/memory-brick";
import {
  DREAM_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  asDiaryEntry,
  type DreamEpisodicSnippet,
} from "@freeanima/habitat/core/db/schema/entity";
import { getEntity } from "@freeanima/habitat/core/db/pg/entity";

import { coerceString } from "@freeanima/shared/coerce-string";

import type { DreamEntryListOpts, DreamEntryRow, DreamStoreContext } from "./types.ts";

async function brickToDreamRow(b: MemoryBrickRow): Promise<DreamEntryRow> {
  let dream_day = b.title.slice(0, 10);
  const parent = await getEntity(b.parent_id);
  if (parent?.primary_component === DIARY_ENTRY_COMPONENT) {
    const diary = asDiaryEntry(parent);
    if (diary) dream_day = diary.entry_at.slice(0, 10);
  }
  const snippets = b.body.episodic_snippets;
  return {
    id: b.id,
    dream_day,
    content: b.content,
    source_limbic_ids: Array.isArray(b.body.source_limbic_ids)
      ? (b.body.source_limbic_ids as unknown[]).map(String)
      : [],
    source_conversation_ids: Array.isArray(b.body.source_conversation_ids)
      ? (b.body.source_conversation_ids as unknown[]).map(String)
      : [],
    episodic_snippets: Array.isArray(snippets) ? (snippets as DreamEpisodicSnippet[]) : [],
    ...(b.body.legacy_id !== undefined ? { legacy_id: coerceString(b.body.legacy_id) } : {}),
    created_at: b.created_at,
  };
}

export async function getDreamEntryByDay(
  ctx: DreamStoreContext,
  day: string,
): Promise<DreamEntryRow | null> {
  const brick = await getDreamBrickByDay(ctx.worldId, day);
  return brick ? brickToDreamRow(brick) : null;
}

export async function getLatestDreamEntry(ctx: DreamStoreContext): Promise<DreamEntryRow | null> {
  const brick = await getLatestDreamBrick(ctx.worldId);
  return brick ? brickToDreamRow(brick) : null;
}

export async function listDreamEntries(
  ctx: DreamStoreContext,
  opts: DreamEntryListOpts = {},
): Promise<DreamEntryRow[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 20));
  const offset = Math.max(0, opts.offset ?? 0);
  const bricks = await listBricksByComponent(ctx.worldId, DREAM_COMPONENT, {
    limit: limit + offset,
  });
  const rows = await Promise.all(bricks.map((b) => brickToDreamRow(b)));
  return rows
    .toSorted((a, b) => {
      const at = Date.parse(a.created_at);
      const bt = Date.parse(b.created_at);
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
      return b.id - a.id;
    })
    .slice(offset, offset + limit);
}

export async function countDreamEntries(ctx: DreamStoreContext): Promise<number> {
  const bricks = await listBricksByComponent(ctx.worldId, DREAM_COMPONENT, { limit: 500 });
  return bricks.length;
}

export async function getDreamEntry(
  ctx: DreamStoreContext,
  id: number,
): Promise<DreamEntryRow | null> {
  const brick = await getMemoryBrick(ctx.worldId, id);
  if (!brick || !brick.components.includes(DREAM_COMPONENT)) return null;
  return brickToDreamRow(brick);
}
