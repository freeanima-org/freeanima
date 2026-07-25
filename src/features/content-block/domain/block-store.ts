import {
  CONTENT_BLOCK_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  DREAM_COMPONENT,
  LIMBIC_COMPONENT,
  NARRATIVE_COMPONENT,
  SEMANTIC_REF_COMPONENT,
  asContentBlock,
  dreamBodySchema,
  limbicBodySchema,
  narrativeBodySchema,
  semanticRefBodySchema,
  type ContentBlockType,
} from "@freeanima/host/core/db/schema/entity";
import {
  assertEntityInWorld,
  assertSameWorldReferent,
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { omitUndefined } from "@freeanima/host/core/util";

import type {
  ContentBlockCreateInput,
  ContentBlockDreamInput,
  ContentBlockLimbicInput,
  ContentBlockListOpts,
  ContentBlockNarrativeInput,
  ContentBlockReorderItem,
  ContentBlockRow,
  ContentBlockSearchOpts,
  ContentBlockSemanticRefInput,
  ContentBlockUpdateInput,
} from "./types.ts";

const CONTAINER_COMPONENTS = new Set<string>([DIARY_ENTRY_COMPONENT]);

async function assertContainer(parentId: number, worldId: number): Promise<void> {
  const parent = await getEntity(parentId);
  if (!parent || !CONTAINER_COMPONENTS.has(parent.primary_component)) {
    throw new Error("parent must be diary_entry");
  }
  await assertEntityInWorld(parentId, worldId);
}

function readLimbic(body: Record<string, unknown>): ContentBlockLimbicInput | null {
  const parsed = limbicBodySchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    valence: parsed.data.valence,
    arousal: parsed.data.arousal,
    intensity: parsed.data.intensity,
  };
}

function readNarrative(body: Record<string, unknown>): ContentBlockNarrativeInput | null {
  const parsed = narrativeBodySchema.safeParse(body);
  if (!parsed.success) return null;
  return omitUndefined({
    significance: parsed.data.significance,
    status: parsed.data.status,
  });
}

function readSemanticRef(body: Record<string, unknown>): ContentBlockSemanticRefInput | null {
  const parsed = semanticRefBodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function readDream(body: Record<string, unknown>): ContentBlockDreamInput | null {
  const parsed = dreamBodySchema.safeParse(body);
  return parsed.success
    ? {
        source_limbic_ids: parsed.data.source_limbic_ids,
        source_conversation_ids: parsed.data.source_conversation_ids,
      }
    : null;
}

function toBlockRow(
  row: NonNullable<ReturnType<typeof asContentBlock>>,
  meta: { components: string[]; created_at: Date; updated_at: Date; body: Record<string, unknown> },
): ContentBlockRow {
  const hasLimbic = meta.components.includes(LIMBIC_COMPONENT);
  const hasNarrative = meta.components.includes(NARRATIVE_COMPONENT);
  const hasSemanticRef = meta.components.includes(SEMANTIC_REF_COMPONENT);
  const hasDream = meta.components.includes(DREAM_COMPONENT);
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    summary: row.summary,
    block_type: row.block_type,
    parent_id: row.parent_id,
    sort_order: row.sort_order,
    url: row.url,
    client_op_id: row.client_op_id,
    components: meta.components,
    limbic: hasLimbic ? readLimbic(meta.body) : null,
    narrative: hasNarrative ? readNarrative(meta.body) : null,
    semantic_ref: hasSemanticRef ? readSemanticRef(meta.body) : null,
    dream: hasDream ? readDream(meta.body) : null,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

function mapHit(row: {
  id: number;
  title: string;
  content: string;
  summary: string;
  components: string[];
  body: Record<string, unknown>;
  pinned: boolean;
  reference_count: number;
  created_at: Date;
  updated_at: Date;
  primary_component: string;
}): ContentBlockRow | null {
  if (row.primary_component !== CONTENT_BLOCK_COMPONENT) return null;
  const parsed = asContentBlock({
    id: row.id,
    type: "content",
    world_id: 0,
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
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
  if (!parsed) return null;
  return toBlockRow(parsed, {
    components: row.components,
    created_at: row.created_at,
    updated_at: row.updated_at,
    body: row.body,
  });
}

function buildComponents(input: {
  limbic?: ContentBlockLimbicInput | null;
  narrative?: ContentBlockNarrativeInput | null;
  semantic_ref?: ContentBlockSemanticRefInput | null;
  dream?: ContentBlockDreamInput | null;
}): string[] {
  const tags: string[] = [CONTENT_BLOCK_COMPONENT];
  if (input.limbic) tags.push(LIMBIC_COMPONENT);
  if (input.narrative) tags.push(NARRATIVE_COMPONENT);
  if (input.semantic_ref) tags.push(SEMANTIC_REF_COMPONENT);
  if (input.dream) tags.push(DREAM_COMPONENT);
  return tags;
}

function semanticBodyFields(input: {
  limbic?: ContentBlockLimbicInput | null;
  narrative?: ContentBlockNarrativeInput | null;
  semantic_ref?: ContentBlockSemanticRefInput | null;
  dream?: ContentBlockDreamInput | null;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.limbic) {
    out.valence = input.limbic.valence;
    out.arousal = input.limbic.arousal;
    out.intensity = input.limbic.intensity;
  }
  if (input.narrative) {
    out.significance = input.narrative.significance ?? "normal";
    if (input.narrative.status !== undefined) out.status = input.narrative.status;
  }
  if (input.semantic_ref) {
    out.entity_id = input.semantic_ref.entity_id;
  }
  if (input.dream) {
    out.source_limbic_ids = input.dream.source_limbic_ids ?? [];
    out.source_conversation_ids = input.dream.source_conversation_ids ?? [];
    out.episodic_snippets = [];
  }
  return out;
}

async function findByClientOpId(
  worldId: number,
  clientOpId: string,
): Promise<ContentBlockRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: CONTENT_BLOCK_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  return row ? mapHit(row) : null;
}

export async function listContentBlocks(
  worldId: number,
  opts: ContentBlockListOpts,
): Promise<ContentBlockRow[]> {
  const filters: Record<string, unknown> = { parent_id: opts.parent_id };
  if (opts.block_type) filters.block_type = opts.block_type;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: CONTENT_BLOCK_COMPONENT,
    ...(opts.component ? { component: opts.component } : {}),
    filters,
    limit: opts.limit ?? 500,
    offset: opts.offset ?? 0,
    mode: "filter_only",
    include_count: false,
  });

  return result.results
    .map((row) => mapHit(row))
    .filter((row): row is ContentBlockRow => row != null)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function createContentBlock(
  worldId: number,
  input: ContentBlockCreateInput,
): Promise<ContentBlockRow> {
  if (input.client_op_id) {
    const existing = await findByClientOpId(worldId, input.client_op_id);
    if (existing) return existing;
  }

  await assertContainer(input.parent_id, worldId);

  const components = buildComponents(input);
  const body = {
    block_type: input.block_type,
    parent_id: input.parent_id,
    sort_order: input.sort_order ?? 0,
    url: input.url ?? null,
    client_op_id: input.client_op_id ?? null,
    ...semanticBodyFields(input),
  };

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components,
    primary_component: CONTENT_BLOCK_COMPONENT,
    title: input.title?.trim() ?? "",
    summary: input.summary?.trim() ?? "",
    content: input.content?.trim() ?? "",
    body,
  });

  const mapped = mapHit(row);
  if (!mapped) throw new Error("content_block create failed");
  return mapped;
}

export async function updateContentBlock(
  worldId: number,
  input: ContentBlockUpdateInput,
): Promise<ContentBlockRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== CONTENT_BLOCK_COMPONENT) return null;
  await assertEntityInWorld(input.id, worldId);

  const parsedExisting = asContentBlock(existing);
  if (!parsedExisting) return null;

  if (input.parent_id != null && input.parent_id !== parsedExisting.parent_id) {
    await assertContainer(input.parent_id, worldId);
    await assertSameWorldReferent(input.id, input.parent_id);
  }

  const nextLimbic =
    input.limbic === undefined
      ? existing.components.includes(LIMBIC_COMPONENT)
        ? readLimbic(existing.body)
        : null
      : input.limbic;
  const nextNarrative =
    input.narrative === undefined
      ? existing.components.includes(NARRATIVE_COMPONENT)
        ? readNarrative(existing.body)
        : null
      : input.narrative;
  const nextSemanticRef =
    input.semantic_ref === undefined
      ? existing.components.includes(SEMANTIC_REF_COMPONENT)
        ? readSemanticRef(existing.body)
        : null
      : input.semantic_ref;
  const nextDream =
    input.dream === undefined
      ? existing.components.includes(DREAM_COMPONENT)
        ? readDream(existing.body)
        : null
      : input.dream;

  const componentsChanged =
    input.limbic !== undefined ||
    input.narrative !== undefined ||
    input.semantic_ref !== undefined ||
    input.dream !== undefined;
  const nextComponents = componentsChanged
    ? buildComponents({
        limbic: nextLimbic,
        narrative: nextNarrative,
        semantic_ref: nextSemanticRef,
        dream: nextDream,
      })
    : existing.components;

  const bodyPatch: Record<string, unknown> = {};
  if (input.block_type !== undefined) bodyPatch.block_type = input.block_type;
  if (input.parent_id !== undefined) bodyPatch.parent_id = input.parent_id;
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.url !== undefined) bodyPatch.url = input.url;

  if (input.limbic !== undefined) {
    if (input.limbic) {
      bodyPatch.valence = input.limbic.valence;
      bodyPatch.arousal = input.limbic.arousal;
      bodyPatch.intensity = input.limbic.intensity;
    }
  }
  if (input.narrative !== undefined) {
    if (input.narrative) {
      bodyPatch.significance = input.narrative.significance ?? "normal";
    }
  }
  if (input.semantic_ref !== undefined) {
    if (input.semantic_ref) {
      bodyPatch.entity_id = input.semantic_ref.entity_id;
    }
  }

  // 组件变更时用完整语义字段重建 body，避免残留字段导致校验失败
  const bodyForWrite = componentsChanged
    ? {
        block_type: (input.block_type ?? parsedExisting.block_type) as ContentBlockType,
        parent_id: input.parent_id ?? parsedExisting.parent_id,
        sort_order: input.sort_order ?? parsedExisting.sort_order,
        url: input.url !== undefined ? input.url : parsedExisting.url,
        client_op_id: parsedExisting.client_op_id,
        ...semanticBodyFields({
          limbic: nextLimbic,
          narrative: nextNarrative,
          semantic_ref: nextSemanticRef,
          dream: nextDream,
        }),
      }
    : Object.keys(bodyPatch).length > 0
      ? bodyPatch
      : undefined;

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title,
      summary: input.summary,
      content: input.content,
      components: componentsChanged ? nextComponents : undefined,
      body: bodyForWrite,
    }),
  );
  if (!row) return null;
  return mapHit(row);
}

export async function deleteContentBlock(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== CONTENT_BLOCK_COMPONENT) return false;
  await assertEntityInWorld(id, worldId);
  return deleteEntity(id);
}

export async function getContentBlock(
  worldId: number,
  id: number,
): Promise<ContentBlockRow | null> {
  const existing = await getEntity(id);
  if (!existing || existing.world_id !== worldId) return null;
  return mapHit(existing);
}

export async function searchContentBlocks(
  worldId: number,
  opts: ContentBlockSearchOpts,
): Promise<ContentBlockRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.parent_id != null) filters.parent_id = opts.parent_id;
  if (opts.block_type) filters.block_type = opts.block_type;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: CONTENT_BLOCK_COMPONENT,
    ...(opts.component ? { component: opts.component } : {}),
    query: opts.query,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: Math.max(1, Math.min(50, opts.limit ?? 30)),
    mode: "hybrid",
    include_count: false,
  });

  return result.results
    .map((row) => mapHit(row))
    .filter((row): row is ContentBlockRow => row != null);
}

export async function reorderContentBlocks(
  worldId: number,
  items: ContentBlockReorderItem[],
): Promise<ContentBlockRow[]> {
  if (items.length === 0) return [];
  const updated: ContentBlockRow[] = [];
  for (const item of items) {
    const row = await updateContentBlock(worldId, {
      id: item.id,
      sort_order: item.sort_order,
    });
    if (!row) throw new Error(`content_block not found: ${item.id}`);
    updated.push(row);
  }
  return updated;
}
