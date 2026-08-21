import { LIMBIC_COMPONENT, type LimbicKind } from "@freeanima/habitat/core/db/schema/entity";
import {
  getMemoryBrick,
  listBricksByComponent,
  listLimbicBricksByCreatedBetween,
  resolveMemoryBrickWorldId,
  searchBricksByComponent,
  type MemoryBrickRow,
} from "@freeanima/habitat/core/db/pg/memory-brick";

import { coerceString } from "@freeanima/shared/coerce-string";

import type {
  LimbicFtsHit,
  LimbicListByConversationsOpts,
  LimbicListByCreatedOpts,
  LimbicListOpts,
  LimbicMemoryRow,
} from "./types.ts";

function brickToRow(b: MemoryBrickRow): LimbicMemoryRow {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- body.kind 运行时枚举
  const kind = (b.body.kind as LimbicKind | undefined) ?? "conversation_mood";
  const semantic = b.body.semantic_memory_ids;
  return {
    id: String(b.id),
    conversation_id: coerceString(b.body.conversation_id ?? ""),
    kind,
    valence: b.body.valence == null ? null : Number(b.body.valence),
    arousal: b.body.arousal == null ? null : Number(b.body.arousal),
    content: b.content,
    intensity: Number(b.body.intensity ?? 0.5),
    source_segment: b.body.source_segment == null ? null : coerceString(b.body.source_segment),
    semantic_memory_ids: Array.isArray(semantic)
      ? semantic.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
      : [],
    created_at: new Date(b.created_at),
    fts_segmented: null,
    content_embedding: null,
  };
}

export async function getLimbicMemory(id: string): Promise<LimbicMemoryRow | null> {
  const worldId = await resolveMemoryBrickWorldId();
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) return null;
  const brick = await getMemoryBrick(worldId, numId);
  if (!brick || !brick.components.includes(LIMBIC_COMPONENT)) return null;
  return brickToRow(brick);
}

export async function listLimbicMemoryBySession(
  conversationId: string,
): Promise<LimbicMemoryRow[]> {
  const worldId = await resolveMemoryBrickWorldId();
  const bricks = await listBricksByComponent(worldId, LIMBIC_COMPONENT, {
    conversation_id: conversationId,
    limit: 200,
  });
  return bricks.map(brickToRow).toSorted((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

export async function listLimbicMemoryBySessions(
  conversationIds: string[],
  opts: LimbicListByConversationsOpts = {},
): Promise<LimbicMemoryRow[]> {
  if (conversationIds.length === 0) return [];
  const worldId = await resolveMemoryBrickWorldId();
  const minI = opts.minIntensity ?? 0;
  const limit = opts.limit ?? 100;
  const byId = new Map<string, LimbicMemoryRow>();
  for (const conversationId of conversationIds) {
    const bricks = await listBricksByComponent(worldId, LIMBIC_COMPONENT, {
      conversation_id: conversationId,
      limit: 200,
    });
    for (const brick of bricks) {
      const row = brickToRow(brick);
      if (row.intensity > minI) byId.set(row.id, row);
    }
  }
  let rows = [...byId.values()];
  if (opts.orderBy === "intensity_desc") {
    rows = rows.toSorted((a, b) => b.intensity - a.intensity);
  } else {
    rows = rows.toSorted((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }
  return rows.slice(0, limit);
}

export async function listLimbicMemoryByCreatedBetween(
  start: Date,
  end: Date,
  opts: LimbicListByCreatedOpts = {},
): Promise<LimbicMemoryRow[]> {
  const worldId = await resolveMemoryBrickWorldId();
  const bricks = await listLimbicBricksByCreatedBetween(worldId, start, end, {
    minIntensity: opts.minIntensity ?? 0,
    limit: opts.limit ?? 100,
  });
  let rows = bricks.map(brickToRow);
  if (opts.orderBy === "intensity_desc") {
    rows = rows.toSorted((a, b) => b.intensity - a.intensity);
  }
  return rows;
}

export async function listLimbicMemory(opts: LimbicListOpts = {}): Promise<LimbicMemoryRow[]> {
  const worldId = await resolveMemoryBrickWorldId();
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  const offset = Math.max(0, opts.offset ?? 0);
  let bricks: MemoryBrickRow[];
  if (opts.query?.trim()) {
    bricks = await searchBricksByComponent(worldId, LIMBIC_COMPONENT, opts.query.trim(), {
      limit: limit + offset,
    });
  } else {
    bricks = await listBricksByComponent(worldId, LIMBIC_COMPONENT, {
      limit: limit + offset,
      ...(opts.conversation_id ? { conversation_id: opts.conversation_id } : {}),
    });
  }
  let rows = bricks.map(brickToRow);
  if (opts.query?.trim() && opts.conversation_id) {
    rows = rows.filter((r) => r.conversation_id === opts.conversation_id);
  }
  if (opts.kind) {
    rows = rows.filter((r) => r.kind === opts.kind);
  }
  return rows.slice(offset, offset + limit);
}

export async function countLimbicMemory(opts: LimbicListOpts = {}): Promise<number> {
  const rows = await listLimbicMemory({ ...opts, limit: 500, offset: 0 });
  return rows.length;
}

export async function searchLimbicMemoryFts(
  query: string,
  opts: { limit?: number } = {},
): Promise<LimbicFtsHit[]> {
  const worldId = await resolveMemoryBrickWorldId();
  const bricks = await searchBricksByComponent(worldId, LIMBIC_COMPONENT, query, {
    limit: opts.limit ?? 30,
  });
  return bricks.map((b, i) => ({ ...brickToRow(b), rank: 1 / (i + 1) }));
}
