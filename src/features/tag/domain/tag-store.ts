import { entities } from "@freeanima/core/db/schema";
import { TAG_COMPONENT, asTag } from "@freeanima/core/db/schema/entity";
import { assertEntityInWorld } from "@freeanima/core/db/pg/entity";
import { getDb } from "@freeanima/core/db/pg/client";
import { suggestTagsByPrimaryComponent, type TagSuggestion } from "@freeanima/core/db/pg/tag";
import { omitUndefined } from "@freeanima/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  searchEntities,
  updateEntity,
} from "@freeanima/core/db/pg/entity";
import { and, eq, ne, sql } from "drizzle-orm";

import type { TagCreateInput, TagRow, TagSearchOpts, TagUpdateInput } from "./types.ts";

function normalizeTitle(title: string): string {
  return title.trim();
}

function titleKey(title: string): string {
  return normalizeTitle(title).toLowerCase();
}

function toTagRow(
  row: NonNullable<ReturnType<typeof asTag>>,
  meta: { created_at: Date; updated_at: Date },
): TagRow {
  return {
    id: row.id,
    title: row.title,
    sort_order: row.sort_order ?? 0,
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
}

async function assertTitleUnique(
  worldId: number,
  title: string,
  excludeId?: number,
): Promise<void> {
  const db = getDb();
  const lowered = titleKey(title);
  if (!lowered) return;
  const conditions = [
    eq(entities.world_id, worldId),
    eq(entities.primary_component, TAG_COMPONENT),
    sql`lower(${entities.title}) = ${lowered}`,
  ];
  if (excludeId != null) {
    conditions.push(ne(entities.id, excludeId));
  }
  const [existing] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(...conditions))
    .limit(1);
  if (existing) {
    throw new Error(`tag title already exists: ${title}`);
  }
}

/** 按 title 查找（忽略大小写）；命中则返回库中原有写法。 */
export async function findTagByTitle(worldId: number, title: string): Promise<TagRow | null> {
  const normalized = normalizeTitle(title);
  if (!normalized) return null;
  const lowered = titleKey(normalized);
  const db = getDb();
  const [hit] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(
      and(
        eq(entities.world_id, worldId),
        eq(entities.primary_component, TAG_COMPONENT),
        sql`lower(${entities.title}) = ${lowered}`,
      ),
    )
    .limit(1);
  if (!hit) return null;
  const row = await getEntity(hit.id);
  if (!row) return null;
  const parsed = asTag(row);
  return parsed
    ? toTagRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

/** 按名称查找或创建 tag；忽略大小写去重；返回 id 列表（保序、去重）。 */
export async function ensureTagsByTitles(worldId: number, titles: string[]): Promise<number[]> {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const raw of titles) {
    const title = normalizeTitle(String(raw));
    if (!title) continue;
    let tag = await findTagByTitle(worldId, title);
    if (!tag) {
      try {
        tag = await createTag(worldId, { title });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.startsWith("tag title already exists:")) throw e;
        tag = await findTagByTitle(worldId, title);
        if (!tag) throw e;
      }
    }
    if (!seen.has(tag.id)) {
      seen.add(tag.id);
      ids.push(tag.id);
    }
  }
  return ids;
}

async function assertTagsInWorld(worldId: number, tagIds: number[]): Promise<void> {
  const unique = [...new Set(tagIds)];
  for (const id of unique) {
    const row = await getEntity(id);
    if (!row || row.primary_component !== TAG_COMPONENT) {
      throw new Error(`tag not found: ${id}`);
    }
    await assertEntityInWorld(id, worldId);
  }
}

export async function listTags(worldId: number): Promise<TagRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: TAG_COMPONENT,
    limit: 500,
  });
  return rows
    .map((row) => {
      const parsed = asTag(row);
      if (!parsed) return null;
      return toTagRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
    })
    .filter((row): row is TagRow => row != null)
    .toSorted(
      (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title) || a.id - b.id,
    );
}

export async function searchTags(
  worldId: number,
  opts: TagSearchOpts = {},
): Promise<{
  tags: TagRow[];
  count: number;
}> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TAG_COMPONENT,
    ...(opts.query?.trim() ? { query: opts.query.trim() } : {}),
    limit: opts.limit ?? 100,
    offset: opts.offset ?? 0,
    mode: opts.query?.trim() ? "hybrid" : "filter_only",
  });
  const tags = result.results
    .map((row) => {
      const parsed = asTag(row);
      if (!parsed) return null;
      return toTagRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
    })
    .filter((row): row is TagRow => row != null)
    .toSorted(
      (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title) || a.id - b.id,
    );
  return { tags, count: result.count };
}

async function findTagByClientOpId(worldId: number, clientOpId: string): Promise<TagRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TAG_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asTag(row);
  return parsed
    ? toTagRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

export async function createTag(worldId: number, input: TagCreateInput): Promise<TagRow> {
  if (input.client_op_id) {
    const existing = await findTagByClientOpId(worldId, input.client_op_id);
    if (existing) return existing;
  }
  const title = normalizeTitle(input.title);
  if (!title) throw new Error("title is required");
  await assertTitleUnique(worldId, title);
  const existing = await listTags(worldId);
  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [TAG_COMPONENT],
    primary_component: TAG_COMPONENT,
    title,
    body: {
      sort_order: input.sort_order ?? existing.length,
      client_op_id: input.client_op_id ?? null,
    },
  });
  const parsed = asTag(row);
  if (!parsed) throw new Error("tag create failed");
  return toTagRow(parsed, { created_at: row.created_at, updated_at: row.updated_at });
}

export async function updateTag(worldId: number, input: TagUpdateInput): Promise<TagRow | null> {
  const existing = await getEntity(input.id);
  if (!existing || existing.primary_component !== TAG_COMPONENT) return null;
  await assertEntityInWorld(input.id, worldId);

  const bodyPatch: Record<string, unknown> = {};
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;

  let nextTitle: string | undefined;
  if (input.title !== undefined) {
    nextTitle = normalizeTitle(input.title);
    if (!nextTitle) throw new Error("title is required");
    if (titleKey(nextTitle) !== titleKey(existing.title)) {
      await assertTitleUnique(worldId, nextTitle, input.id);
    }
  }

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: nextTitle,
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;
  const parsed = asTag(row);
  return parsed
    ? toTagRow(parsed, { created_at: row.created_at, updated_at: row.updated_at })
    : null;
}

async function stripTagIdFromWorld(worldId: number, tagId: number): Promise<void> {
  const db = getDb();
  await db
    .update(entities)
    .set({
      tag_ids: sql`array_remove(${entities.tag_ids}, ${tagId})`,
      updated_at: new Date(),
    })
    .where(
      and(eq(entities.world_id, worldId), sql`${entities.tag_ids} @> ARRAY[${tagId}]::bigint[]`),
    );
}

export async function deleteTag(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== TAG_COMPONENT) return false;
  await assertEntityInWorld(id, worldId);
  await stripTagIdFromWorld(worldId, id);
  return deleteEntity(id);
}

export async function setEntityTagIds(
  worldId: number,
  entityId: number,
  tagIds: number[],
): Promise<{ entity_id: number; tag_ids: number[] }> {
  const entity = await getEntity(entityId);
  if (!entity) throw new Error(`entity not found: ${entityId}`);
  await assertEntityInWorld(entityId, worldId);
  if (entity.primary_component === TAG_COMPONENT) {
    throw new Error("cannot set tags on a tag entity");
  }
  const unique = [...new Set(tagIds.filter((id) => Number.isFinite(id) && id > 0))];
  await assertTagsInWorld(worldId, unique);
  const row = await updateEntity({ id: entityId, tag_ids: unique });
  if (!row) throw new Error(`entity not found: ${entityId}`);
  return { entity_id: entityId, tag_ids: [...row.tag_ids] };
}

export async function suggestTags(
  worldId: number,
  primaryComponent: string,
  opts?: { query?: string; limit?: number },
): Promise<TagSuggestion[]> {
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const query = opts?.query?.trim() ?? "";
  return suggestTagsByPrimaryComponent(worldId, primaryComponent, {
    ...(query ? { query } : {}),
    limit,
  });
}
