import {
  CONTENT_BLOCK_COMPONENT,
  DREAM_COMPONENT,
  LIMBIC_COMPONENT,
  NARRATIVE_COMPONENT,
  asContentBlock,
} from "@freeanima/habitat/core/db/schema/entity";
import { getEntity, searchEntities } from "@freeanima/habitat/core/db/pg/entity";
import { findDiaryIdOnly } from "./diary-lookup.ts";

export type MemoryBrickRow = {
  id: number;
  world_id: number;
  title: string;
  content: string;
  summary: string;
  parent_id: number;
  sort_order: number;
  components: string[];
  body: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function mapBrick(row: {
  id: number;
  type: string;
  world_id: number;
  title: string;
  content: string;
  summary: string;
  components: string[];
  body: Record<string, unknown>;
  pinned: boolean;
  reference_count: number;
  created_at: Date;
  updated_at: Date;
  primary_component: string | null;
}): MemoryBrickRow | null {
  if (row.primary_component !== CONTENT_BLOCK_COMPONENT) return null;
  const parsed = asContentBlock({
    id: row.id,
    type: "content",
    world_id: row.world_id,
    components: row.components,
    primary_component: row.primary_component,
    title: row.title,
    content: row.content,
    summary: row.summary,
    body: row.body,
    pinned: row.pinned,
    reference_count: row.reference_count,
    tag_ids: [],
    revisions: [],
    deleted_at: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
  if (!parsed) return null;
  return {
    id: row.id,
    world_id: row.world_id,
    title: row.title,
    content: row.content,
    summary: row.summary,
    parent_id: parsed.parent_id,
    sort_order: parsed.sort_order,
    components: row.components,
    body: row.body,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function getMemoryBrick(worldId: number, id: number): Promise<MemoryBrickRow | null> {
  const row = await getEntity(id);
  if (!row || row.world_id !== worldId) return null;
  return mapBrick(row);
}

export async function listBricksByComponent(
  worldId: number,
  component: typeof LIMBIC_COMPONENT | typeof NARRATIVE_COMPONENT | typeof DREAM_COMPONENT,
  opts: {
    limit?: number;
    offset?: number;
    parent_id?: number;
    conversation_id?: string;
  } = {},
): Promise<MemoryBrickRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.parent_id != null) filters.parent_id = opts.parent_id;
  if (opts.conversation_id) filters.conversation_id = opts.conversation_id;
  const result = await searchEntities({
    world_id: worldId,
    primary_component: CONTENT_BLOCK_COMPONENT,
    component,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: Math.max(1, Math.min(200, opts.limit ?? 50)),
    offset: Math.max(0, opts.offset ?? 0),
    mode: "filter_only",
    include_count: false,
  });
  return result.results
    .map((row) => mapBrick(row))
    .filter((row): row is MemoryBrickRow => row != null);
}

export async function searchBricksByComponent(
  worldId: number,
  component: typeof LIMBIC_COMPONENT | typeof NARRATIVE_COMPONENT | typeof DREAM_COMPONENT,
  query: string,
  opts: { limit?: number; parent_id?: number } = {},
): Promise<MemoryBrickRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.parent_id != null) filters.parent_id = opts.parent_id;
  const result = await searchEntities({
    world_id: worldId,
    primary_component: CONTENT_BLOCK_COMPONENT,
    component,
    query,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: Math.max(1, Math.min(50, opts.limit ?? 30)),
    mode: "hybrid",
    include_count: false,
  });
  return result.results
    .map((row) => mapBrick(row))
    .filter((row): row is MemoryBrickRow => row != null);
}

/** 按日取 dream 块（经 parent diary；不创建 diary） */
export async function getDreamBrickByDay(
  worldId: number,
  day: string,
): Promise<MemoryBrickRow | null> {
  const diaryId = await findDiaryIdOnly(worldId, day);
  if (diaryId == null) return null;
  const bricks = await listBricksByComponent(worldId, DREAM_COMPONENT, {
    parent_id: diaryId,
    limit: 5,
  });
  return bricks[0] ?? null;
}

export async function getLatestDreamBrick(worldId: number): Promise<MemoryBrickRow | null> {
  const bricks = await listBricksByComponent(worldId, DREAM_COMPONENT, { limit: 20 });
  if (bricks.length === 0) return null;
  const sorted = bricks.toSorted((a, b) => {
    const at = Date.parse(a.created_at);
    const bt = Date.parse(b.created_at);
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
    return b.id - a.id;
  });
  return sorted[0] ?? null;
}

export async function listLimbicBricksByCreatedBetween(
  worldId: number,
  start: Date,
  end: Date,
  opts: { minIntensity?: number; limit?: number } = {},
): Promise<MemoryBrickRow[]> {
  const bricks = await listBricksByComponent(worldId, LIMBIC_COMPONENT, {
    limit: Math.max(opts.limit ?? 100, 200),
  });
  const minI = opts.minIntensity ?? 0;
  const startMs = start.getTime();
  const endMs = end.getTime();
  return bricks
    .filter((b) => {
      const t = Date.parse(b.created_at);
      if (!Number.isFinite(t) || t < startMs || t >= endMs) return false;
      return Number(b.body.intensity ?? 0) > minI;
    })
    .toSorted((a, b) => Number(b.body.intensity ?? 0) - Number(a.body.intensity ?? 0))
    .slice(0, opts.limit ?? 100);
}
