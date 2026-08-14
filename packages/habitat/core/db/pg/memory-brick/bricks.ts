import type {
  DreamEpisodicSnippet,
  LimbicKind,
  NarrativeSignificance,
  NarrativeStatus,
} from "@freeanima/habitat/core/db/schema/entity";
import {
  CONTENT_BLOCK_COMPONENT,
  DREAM_COMPONENT,
  LIMBIC_COMPONENT,
  NARRATIVE_COMPONENT,
  asContentBlock,
} from "@freeanima/habitat/core/db/schema/entity";
import { formatCstIso } from "@freeanima/habitat/core/util";
import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { resolveMemoryCutoverFlags } from "@freeanima/habitat/core/config/schemas/memory-config.ts";
import {
  createEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";
import { ensureDiaryEntryForDay } from "@freeanima/habitat/core/db/pg/diary";
import { findDiaryIdOnly } from "./diary-lookup.ts";

const PARKED_WRITE_MESSAGE =
  "该记忆类型已 park（#16102）：limbic / dream / narrative 停写，存量只读";

function assertNotParkedSemanticWrite(): void {
  let parked: boolean;
  try {
    parked = resolveMemoryCutoverFlags(getActiveRuntimeConfig().data).park_limbic_dream_narrative;
  } catch {
    parked = resolveMemoryCutoverFlags(null).park_limbic_dream_narrative;
  }
  if (parked) throw new Error(PARKED_WRITE_MESSAGE);
}
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

export type LimbicBrickCreateInput = {
  content: string;
  valence: number;
  arousal: number;
  intensity: number;
  kind?: LimbicKind;
  conversation_id?: string;
  source_segment?: string | null;
  semantic_memory_ids?: number[];
  legacy_id?: string;
  /** CST YYYY-MM-DD；缺省用现在 */
  day?: string;
  title?: string;
};

export type NarrativeBrickCreateInput = {
  title: string;
  content: string;
  significance?: NarrativeSignificance;
  period_start?: string | null;
  period_end?: string | null;
  source_facts?: number[];
  source_conversations?: string[];
  status?: NarrativeStatus;
  legacy_id?: string;
  day?: string;
};

export type DreamBrickCreateInput = {
  content: string;
  day: string;
  source_limbic_ids?: string[];
  source_conversation_ids?: string[];
  episodic_snippets?: DreamEpisodicSnippet[];
  legacy_id?: string;
  title?: string;
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

async function nextSortOrder(worldId: number, parentId: number): Promise<number> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: CONTENT_BLOCK_COMPONENT,
    filters: { parent_id: parentId },
    limit: 500,
    mode: "filter_only",
    include_count: false,
  });
  let max = -1;
  for (const row of result.results) {
    const parsed = asContentBlock(row);
    if (parsed && parsed.sort_order > max) max = parsed.sort_order;
  }
  return max + 1;
}

export async function createLimbicBrick(
  worldId: number,
  input: LimbicBrickCreateInput,
): Promise<MemoryBrickRow> {
  assertNotParkedSemanticWrite();
  const day = input.day ?? formatCstIso(new Date()).slice(0, 10);
  const diary = await ensureDiaryEntryForDay(worldId, day);
  const sort_order = await nextSortOrder(worldId, diary.id);
  const components = [CONTENT_BLOCK_COMPONENT, LIMBIC_COMPONENT];
  const body = {
    block_type: "text" as const,
    parent_id: diary.id,
    sort_order,
    url: null,
    client_op_id: null,
    valence: input.valence,
    arousal: input.arousal,
    intensity: input.intensity,
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.conversation_id !== undefined ? { conversation_id: input.conversation_id } : {}),
    ...(input.source_segment !== undefined ? { source_segment: input.source_segment } : {}),
    semantic_memory_ids: input.semantic_memory_ids ?? [],
    ...(input.legacy_id !== undefined ? { legacy_id: input.legacy_id } : {}),
  };
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components,
    primary_component: CONTENT_BLOCK_COMPONENT,
    title: input.title?.trim() ?? "",
    summary: "",
    content: input.content.trim(),
    body,
  });
  const mapped = mapBrick(row);
  if (!mapped) throw new Error("limbic brick create failed");
  return mapped;
}

export async function createNarrativeBrick(
  worldId: number,
  input: NarrativeBrickCreateInput,
): Promise<MemoryBrickRow> {
  assertNotParkedSemanticWrite();
  const day = input.day ?? formatCstIso(new Date()).slice(0, 10);
  const diary = await ensureDiaryEntryForDay(worldId, day);
  const sort_order = await nextSortOrder(worldId, diary.id);
  const components = [CONTENT_BLOCK_COMPONENT, NARRATIVE_COMPONENT];
  const body = {
    block_type: "text" as const,
    parent_id: diary.id,
    sort_order,
    url: null,
    client_op_id: null,
    significance: input.significance ?? "normal",
    period_start: input.period_start ?? null,
    period_end: input.period_end ?? null,
    source_facts: input.source_facts ?? [],
    source_conversations: input.source_conversations ?? [],
    status: input.status ?? "active",
    ...(input.legacy_id !== undefined ? { legacy_id: input.legacy_id } : {}),
  };
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components,
    primary_component: CONTENT_BLOCK_COMPONENT,
    title: input.title.trim(),
    summary: "",
    content: input.content.trim(),
    body,
  });
  const mapped = mapBrick(row);
  if (!mapped) throw new Error("narrative brick create failed");
  return mapped;
}

export async function createDreamBrick(
  worldId: number,
  input: DreamBrickCreateInput,
): Promise<MemoryBrickRow> {
  assertNotParkedSemanticWrite();
  const existing = await getDreamBrickByDay(worldId, input.day);
  if (existing) {
    throw new Error(`dream already exists for ${input.day}`);
  }
  const diary = await ensureDiaryEntryForDay(worldId, input.day);
  const sort_order = await nextSortOrder(worldId, diary.id);
  const components = [CONTENT_BLOCK_COMPONENT, DREAM_COMPONENT];
  const body = {
    block_type: "text" as const,
    parent_id: diary.id,
    sort_order,
    url: null,
    client_op_id: null,
    source_limbic_ids: input.source_limbic_ids ?? [],
    source_conversation_ids: input.source_conversation_ids ?? [],
    episodic_snippets: input.episodic_snippets ?? [],
    ...(input.legacy_id !== undefined ? { legacy_id: input.legacy_id } : {}),
  };
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components,
    primary_component: CONTENT_BLOCK_COMPONENT,
    title: input.title?.trim() ?? input.day,
    summary: "",
    content: input.content.trim(),
    body,
  });
  const mapped = mapBrick(row);
  if (!mapped) throw new Error("dream brick create failed");
  return mapped;
}

export async function getMemoryBrick(worldId: number, id: number): Promise<MemoryBrickRow | null> {
  const row = await getEntity(id);
  if (!row || row.world_id !== worldId) return null;
  return mapBrick(row);
}

export async function deprecateNarrativeBrick(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.world_id !== worldId) return false;
  if (existing.primary_component !== CONTENT_BLOCK_COMPONENT) return false;
  if (!existing.components.includes(NARRATIVE_COMPONENT)) return false;
  const updated = await updateEntity({
    id,
    body: { ...existing.body, status: "deprecated" },
  });
  return updated != null;
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
