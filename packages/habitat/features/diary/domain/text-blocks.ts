import {
  CONTENT_BLOCK_COMPONENT,
  DIARY_ENTRY_COMPONENT,
  asContentBlock,
} from "@freeanima/habitat/core/db/schema/entity";
import {
  assertEntityInWorld,
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";

import type {
  DiaryStoreContext,
  DiaryTextBlock,
  DiaryTextBlockCreateInput,
  DiaryTextBlockReorderItem,
  DiaryTextBlockUpdateInput,
} from "./types.ts";

function normalizeBlockComponents(components: string[] | undefined): string[] {
  const list = (components ?? [CONTENT_BLOCK_COMPONENT]).map((c) => c.trim()).filter(Boolean);
  if (!list.includes(CONTENT_BLOCK_COMPONENT)) {
    list.unshift(CONTENT_BLOCK_COMPONENT);
  }
  return [...new Set(list)];
}

function toTextBlock(
  row: NonNullable<ReturnType<typeof asContentBlock>>,
  meta: {
    created_at: Date;
    updated_at: Date;
    components: string[];
    tag_ids: number[];
  },
): DiaryTextBlock | null {
  if (row.block_type !== "text") return null;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    sort_order: row.sort_order,
    parent_id: row.parent_id,
    client_op_id: row.client_op_id,
    components: meta.components,
    tag_ids: [...meta.tag_ids],
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
  pinned?: boolean;
  reference_count?: number;
  tag_ids?: number[];
  created_at: Date;
  updated_at: Date;
  primary_component: string | null;
}): DiaryTextBlock | null {
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
    pinned: row.pinned ?? false,
    reference_count: row.reference_count ?? 0,
    tag_ids: [...(row.tag_ids ?? [])],
    revisions: [],
    deleted_at: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
  if (!parsed) return null;
  return toTextBlock(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    components: row.components,
    tag_ids: row.tag_ids ?? [],
  });
}

async function assertDiaryContainer(parentId: number, worldId: number): Promise<void> {
  const parent = await getEntity(parentId);
  if (!parent || parent.primary_component !== DIARY_ENTRY_COMPONENT) {
    throw new Error("parent must be diary_entry");
  }
  await assertEntityInWorld(parentId, worldId);
}

async function findByClientOpId(
  worldId: number,
  clientOpId: string,
): Promise<DiaryTextBlock | null> {
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

export async function listDiaryTextBlocks(
  ctx: DiaryStoreContext,
  parentId: number,
): Promise<DiaryTextBlock[]> {
  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: CONTENT_BLOCK_COMPONENT,
    filters: { parent_id: parentId, block_type: "text" },
    limit: 500,
    mode: "filter_only",
    include_count: false,
  });
  return result.results
    .map((row) => mapHit(row))
    .filter((row): row is DiaryTextBlock => row != null)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function createDiaryTextBlock(
  ctx: DiaryStoreContext,
  input: DiaryTextBlockCreateInput,
): Promise<DiaryTextBlock> {
  if (input.client_op_id) {
    const existing = await findByClientOpId(ctx.worldId, input.client_op_id);
    if (existing) return existing;
  }

  await assertDiaryContainer(input.parent_id, ctx.worldId);

  let sortOrder = input.sort_order;
  if (sortOrder == null) {
    const existing = await listDiaryTextBlocks(ctx, input.parent_id);
    const last = existing.at(-1);
    sortOrder = last ? last.sort_order + 1 : 0;
  }

  const components = normalizeBlockComponents(input.components);

  const row = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    components,
    primary_component: CONTENT_BLOCK_COMPONENT,
    title: input.title?.trim() ?? "",
    summary: "",
    content: input.content,
    tag_ids: input.tag_ids ?? [],
    body: {
      block_type: "text",
      parent_id: input.parent_id,
      sort_order: sortOrder,
      url: null,
      client_op_id: input.client_op_id ?? null,
    },
  });

  const mapped = mapHit(row);
  if (!mapped) throw new Error("diary text block create failed");
  return mapped;
}

export async function updateDiaryTextBlock(
  ctx: DiaryStoreContext,
  input: DiaryTextBlockUpdateInput,
): Promise<DiaryTextBlock | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== CONTENT_BLOCK_COMPONENT) return null;
  await assertEntityInWorld(input.id, ctx.worldId);

  const parsed = asContentBlock(existing);
  if (!parsed || parsed.block_type !== "text") return null;
  await assertDiaryContainer(parsed.parent_id, ctx.worldId);

  const bodyPatch: Record<string, unknown> = {};
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      content: input.content,
      title: input.title !== undefined ? input.title.trim() : undefined,
      tag_ids: input.tag_ids,
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;
  return mapHit(row);
}

export async function deleteDiaryTextBlock(ctx: DiaryStoreContext, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== CONTENT_BLOCK_COMPONENT) return false;
  await assertEntityInWorld(id, ctx.worldId);
  const parsed = asContentBlock(existing);
  if (!parsed || parsed.block_type !== "text") return false;
  await assertDiaryContainer(parsed.parent_id, ctx.worldId);
  return deleteEntity(id);
}

export async function deleteAllDiaryTextBlocks(
  ctx: DiaryStoreContext,
  parentId: number,
): Promise<void> {
  const blocks = await listDiaryTextBlocks(ctx, parentId);
  for (const block of blocks) {
    await deleteEntity(block.id);
  }
}

export async function reorderDiaryTextBlocks(
  ctx: DiaryStoreContext,
  items: DiaryTextBlockReorderItem[],
): Promise<DiaryTextBlock[]> {
  if (items.length === 0) return [];
  const updated: DiaryTextBlock[] = [];
  for (const item of items) {
    const row = await updateDiaryTextBlock(ctx, {
      id: item.id,
      sort_order: item.sort_order,
    });
    if (!row) throw new Error(`diary text block not found: ${item.id}`);
    updated.push(row);
  }
  return updated;
}

/** 按 text 块正文 hybrid 搜索，返回命中的 parent diary id（保序去重） */
export async function searchDiaryParentIdsByBlockText(
  ctx: DiaryStoreContext,
  query: string,
  limit: number,
): Promise<number[]> {
  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: CONTENT_BLOCK_COMPONENT,
    query,
    filters: { block_type: "text" },
    limit: Math.max(1, Math.min(100, limit * 3)),
    mode: "hybrid",
    include_count: false,
  });

  const parentIds: number[] = [];
  const seen = new Set<number>();
  for (const row of result.results) {
    const block = mapHit(row);
    if (!block || seen.has(block.parent_id)) continue;
    seen.add(block.parent_id);
    parentIds.push(block.parent_id);
    if (parentIds.length >= limit) break;
  }
  return parentIds;
}
