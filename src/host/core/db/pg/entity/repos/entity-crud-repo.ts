import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { entities, entityTypeSchema } from "@freeanima/host/core/db/schema";
import {
  mergeComponentBody,
  mapEntityRow,
  entityRowSelectColumns,
  isKnownComponent,
  pickPromotedPrimaryComponent,
  primaryComponentSchema,
  stripRemovedComponentBodyFields,
  validateEntityBody,
  entitySearchTextForWrite,
  isEntityRevisionPrimaryComponent,
  pushEntityRevision,
  shouldRecordEntityRevision,
  snapshotEntityRevision,
  OBJECT_FILE_COMPONENT,
  type EntityRowSelect,
} from "@freeanima/host/core/db/schema/entity";
import type {
  EntityCreateInput,
  EntityGetOpts,
  EntityListOpts,
  EntityRow,
  EntityUpdateInput,
} from "../types.ts";

import { resolveFtsSegmentedForWrite } from "../../fts/write.ts";
import { scheduleEntityEmbedding, clearEntityEmbedding } from "../../embedding/entity-embedding.ts";
import { getDb, type DbSession } from "../../client.ts";

function mapRow(row: EntityRowSelect | typeof entities.$inferSelect): EntityRow {
  return mapEntityRow(row);
}

function normalizeCreate(input: EntityCreateInput) {
  const type = entityTypeSchema.parse(input.type);
  const primary = primaryComponentSchema.parse(input.primary_component);
  const components = [...new Set([...input.components, primary])];
  const body = validateEntityBody(components, input.body);
  return {
    type,
    primary,
    components,
    body,
    title: input.title?.trim() ?? "",
    summary: input.summary?.trim() ?? "",
    content: input.content ?? "",
  };
}

export async function createEntity(
  input: EntityCreateInput,
  session?: DbSession,
): Promise<EntityRow> {
  const { type, primary, components, body, title, summary, content } = normalizeCreate(input);
  const now = new Date();
  const indexText = entitySearchTextForWrite({
    title,
    summary,
    content,
    body,
    primary_component: primary,
  });
  const fts_segmented = await resolveFtsSegmentedForWrite(indexText);
  const db = session ?? getDb();
  const [row] = await db
    .insert(entities)
    .values({
      type,
      world_id: input.world_id,
      components,
      primary_component: primary,
      title,
      summary,
      content,
      body,
      pinned: input.pinned ?? false,
      reference_count: input.reference_count ?? 0,
      tag_ids: input.tag_ids ?? [],
      revisions: [],
      fts_segmented,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? input.created_at ?? now,
    })
    .returning(entityRowSelectColumns);
  if (!row) throw new Error("entity insert failed");
  scheduleEntityEmbedding(row.id, indexText);
  return mapRow(row);
}

export type EntityCreateAtIdInput = EntityCreateInput & { id: number };

/** 指定 id 插入（bootstrap subject 占位 id）；PG identity OVERRIDING SYSTEM VALUE */
export async function createEntityAtId(input: EntityCreateAtIdInput): Promise<EntityRow> {
  const { type, primary, components, body, title, summary, content } = normalizeCreate(input);
  const now = new Date();
  const indexText = entitySearchTextForWrite({
    title,
    summary,
    content,
    body,
    primary_component: primary,
  });
  const fts_segmented = await resolveFtsSegmentedForWrite(indexText);
  const db = getDb();
  const [row] = await db
    .insert(entities)
    .overridingSystemValue()
    .values({
      id: input.id,
      type,
      world_id: input.world_id,
      components,
      primary_component: primary,
      title,
      summary,
      content,
      body,
      tag_ids: input.tag_ids ?? [],
      revisions: [],
      fts_segmented,
      created_at: now,
      updated_at: now,
    })
    .returning(entityRowSelectColumns);
  if (!row) throw new Error("entity insert at id failed");
  await db
    .select({
      _: sql`setval(
        pg_get_serial_sequence('entities', 'id'),
        GREATEST((SELECT MAX(id) FROM entities), ${input.id})
      )`,
    })
    .from(entities)
    .limit(1);
  scheduleEntityEmbedding(row.id, indexText);
  return mapRow(row);
}

export async function getEntity(id: number, opts?: EntityGetOpts): Promise<EntityRow | null> {
  const db = getDb();
  const [row] = await db
    .select(entityRowSelectColumns)
    .from(entities)
    .where(eq(entities.id, id))
    .limit(1);
  if (!row) return null;
  const mapped = mapRow(row);
  if (!opts?.include_deleted && mapped.deleted_at != null) return null;
  return mapped;
}

export async function updateEntity(input: EntityUpdateInput): Promise<EntityRow | null> {
  const existing = await getEntity(input.id);
  if (!existing) return null;

  const components = input.components ?? existing.components;
  const body = input.body
    ? mergeComponentBody(existing.body, input.body, components)
    : existing.body;

  validateEntityBody(components, body);

  const now = new Date();
  const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
  const nextSummary = input.summary !== undefined ? input.summary.trim() : existing.summary;
  const nextContent = input.content !== undefined ? input.content : existing.content;
  const nextPinned = input.pinned !== undefined ? input.pinned : existing.pinned;
  const nextTagIds = input.tag_ids !== undefined ? input.tag_ids : existing.tag_ids;
  const indexText = entitySearchTextForWrite({
    title: nextTitle,
    summary: nextSummary,
    content: nextContent,
    body,
    primary_component: existing.primary_component,
  });

  const patch: Partial<typeof entities.$inferInsert> = {
    components,
    body,
    updated_at: now,
  };
  if (input.title !== undefined) patch.title = nextTitle;
  if (input.summary !== undefined) patch.summary = nextSummary;
  if (input.content !== undefined) patch.content = nextContent;
  if (input.world_id !== undefined) patch.world_id = input.world_id;
  if (input.pinned !== undefined) patch.pinned = nextPinned;
  if (input.reference_count !== undefined) patch.reference_count = input.reference_count;
  if (input.tag_ids !== undefined) patch.tag_ids = nextTagIds;

  if (input.revisions !== undefined) {
    patch.revisions = input.revisions;
  } else if (
    !input.skip_revision &&
    isEntityRevisionPrimaryComponent(existing.primary_component) &&
    shouldRecordEntityRevision(input)
  ) {
    patch.revisions = pushEntityRevision(
      existing.revisions,
      snapshotEntityRevision({
        title: existing.title,
        summary: existing.summary,
        content: existing.content,
        body: existing.body,
        tag_ids: existing.tag_ids,
        pinned: existing.pinned,
        updated_at: existing.updated_at,
      }),
    );
  }

  const textChanged =
    input.title !== undefined ||
    input.summary !== undefined ||
    input.content !== undefined ||
    input.body !== undefined;
  if (textChanged) {
    patch.fts_segmented = await resolveFtsSegmentedForWrite(indexText);
    await clearEntityEmbedding(input.id);
  }

  const db = getDb();
  const [row] = await db
    .update(entities)
    .set(patch)
    .where(eq(entities.id, input.id))
    .returning(entityRowSelectColumns);
  if (textChanged && row) {
    scheduleEntityEmbedding(row.id, indexText);
  }
  return row ? mapRow(row) : null;
}

/**
 * 将 entities.revisions[index] 恢复为当前态（会先归档当前）。
 * 越界返回 null。
 */
export async function restoreEntityRevision(
  id: number,
  revisionIndex: number,
): Promise<EntityRow | null> {
  const existing = await getEntity(id);
  if (!existing) return null;
  const revision = existing.revisions[revisionIndex];
  if (!revision) return null;
  return updateEntity({
    id,
    title: revision.title,
    summary: revision.summary,
    content: revision.content,
    body: revision.body,
    tag_ids: revision.tag_ids,
    pinned: revision.pinned,
  });
}

export class EntityDeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityDeleteError";
  }
}

/**
 * 软删实体（写 deleted_at）。agent/user/world 拒绝。
 * 已软删时幂等返回 true。
 */
export async function deleteEntity(id: number): Promise<boolean> {
  const existing = await getEntity(id, { include_deleted: true });
  if (!existing) return false;
  if (existing.deleted_at != null) return true;
  if (existing.type === "agent" || existing.type === "user" || existing.type === "world") {
    throw new EntityDeleteError(`cannot soft-delete entity type=${existing.type}`);
  }
  const now = new Date();
  const db = getDb();
  const result = await db
    .update(entities)
    .set({ deleted_at: now, updated_at: now })
    .where(and(eq(entities.id, id), isNull(entities.deleted_at)))
    .returning({ id: entities.id });
  return result.length > 0;
}

/** 从回收站恢复（清 deleted_at）；不恢复容器 membership。 */
export async function restoreEntity(id: number): Promise<EntityRow | null> {
  const existing = await getEntity(id, { include_deleted: true });
  if (!existing || existing.deleted_at == null) return existing;
  const now = new Date();
  const db = getDb();
  const [row] = await db
    .update(entities)
    .set({ deleted_at: null, updated_at: now })
    .where(eq(entities.id, id))
    .returning(entityRowSelectColumns);
  return row ? mapRow(row) : null;
}

/** 物理删除一行（仅 purge / 内部清理）。 */
export async function purgeEntity(id: number): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(entities)
    .where(eq(entities.id, id))
    .returning({ id: entities.id });
  return result.length > 0;
}

/** purge 返回的行元数据（供 object_file blob GC 等后续清理）。 */
export type PurgedEntityRow = {
  id: number;
  world_id: number;
  primary_component: string | null;
  body: unknown;
};

export type PurgeSoftDeletedEntitiesResult = {
  purged: number;
  rows: PurgedEntityRow[];
};

/** 物理清理 deleted_at 早于 olderThan 的软删实体。 */
export async function purgeSoftDeletedEntities(opts: {
  olderThan: Date;
  page_size?: number;
}): Promise<PurgeSoftDeletedEntitiesResult> {
  const db = getDb();
  const pageSize = Math.max(1, Math.min(500, opts.page_size ?? 200));
  let purged = 0;
  const allRows: PurgedEntityRow[] = [];
  while (true) {
    const rows = await db
      .delete(entities)
      .where(
        sql`${entities.id} IN (
          SELECT id FROM ${entities}
          WHERE ${entities.deleted_at} IS NOT NULL
            AND ${entities.deleted_at} < ${opts.olderThan}
          ORDER BY ${entities.deleted_at}
          LIMIT ${pageSize}
        )`,
      )
      .returning({
        id: entities.id,
        world_id: entities.world_id,
        primary_component: entities.primary_component,
        body: entities.body,
      });
    purged += rows.length;
    for (const row of rows) {
      allRows.push({
        id: row.id,
        world_id: row.world_id,
        primary_component: row.primary_component,
        body: row.body,
      });
    }
    if (rows.length < pageSize) break;
  }
  return { purged, rows: allRows };
}

/**
 * 统计同 world 内仍引用某 cid 的 object_file 实体数（含软删，供 purge 后 blob GC）。
 */
export async function countObjectFileCidRefs(worldId: number, cid: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(entities)
    .where(
      and(
        eq(entities.world_id, worldId),
        eq(entities.primary_component, OBJECT_FILE_COMPONENT),
        sql`${entities.body}->>'cid' = ${cid}`,
      ),
    );
  return Number(row?.value ?? 0);
}

/**
 * 删除 entity 上的某个 component；必要时提升 primary；可变成空壳。
 * 不自动软删。
 */
export async function deleteEntityComponent(
  id: number,
  component: string,
): Promise<EntityRow | null> {
  if (!isKnownComponent(component)) {
    throw new EntityDeleteError(`unknown component: ${component}`);
  }
  const existing = await getEntity(id);
  if (!existing) return null;
  if (!existing.components.includes(component)) return existing;

  const remaining = existing.components.filter((c) => c !== component);
  const nextBody = stripRemovedComponentBodyFields(existing.body, component, remaining);
  const nextPrimary =
    existing.primary_component === component
      ? pickPromotedPrimaryComponent(remaining)
      : existing.primary_component != null && remaining.includes(existing.primary_component)
        ? existing.primary_component
        : pickPromotedPrimaryComponent(remaining);

  if (remaining.length > 0) {
    validateEntityBody(remaining, nextBody);
  }

  const now = new Date();
  const indexText = entitySearchTextForWrite({
    title: existing.title,
    summary: existing.summary,
    content: existing.content,
    body: nextBody,
    primary_component: nextPrimary,
  });
  const fts_segmented = await resolveFtsSegmentedForWrite(indexText);
  await clearEntityEmbedding(id);

  const db = getDb();
  const [row] = await db
    .update(entities)
    .set({
      components: remaining,
      primary_component: nextPrimary,
      body: nextBody,
      fts_segmented,
      updated_at: now,
    })
    .where(eq(entities.id, id))
    .returning(entityRowSelectColumns);
  if (row) scheduleEntityEmbedding(row.id, indexText);
  return row ? mapRow(row) : null;
}

export type EntityReferenceHit = {
  entity_id: number;
  via: string;
};

/** 扫描已知引用面（body FK / tag_ids）；供 deleteEntity 前确认。 */
export async function collectEntityReferences(id: number): Promise<EntityReferenceHit[]> {
  const db = getDb();
  const hits: EntityReferenceHit[] = [];
  const idStr = String(id);

  const fkRows = await db
    .select({ id: entities.id, body: entities.body, tag_ids: entities.tag_ids })
    .from(entities)
    .where(
      and(
        isNull(entities.deleted_at),
        sql`${entities.id} <> ${id}`,
        sql`(
          ${entities.body}->>'list_id' = ${idStr}
          OR ${entities.body}->>'project_id' = ${idStr}
          OR ${entities.body}->>'parent_id' = ${idStr}
          OR ${entities.body}->>'folder_id' = ${idStr}
          OR ${entities.body}->>'account_id' = ${idStr}
          OR ${entities.tag_ids} @> ARRAY[${id}]::bigint[]
        )`,
      ),
    )
    .limit(200);

  for (const row of fkRows) {
    const body = (row.body ?? {}) as Record<string, unknown>;
    if (String(body.list_id ?? "") === idStr) hits.push({ entity_id: row.id, via: "body.list_id" });
    if (String(body.project_id ?? "") === idStr)
      hits.push({ entity_id: row.id, via: "body.project_id" });
    if (String(body.parent_id ?? "") === idStr)
      hits.push({ entity_id: row.id, via: "body.parent_id" });
    if (String(body.folder_id ?? "") === idStr)
      hits.push({ entity_id: row.id, via: "body.folder_id" });
    if (String(body.account_id ?? "") === idStr)
      hits.push({ entity_id: row.id, via: "body.account_id" });
    if ((row.tag_ids ?? []).includes(id)) hits.push({ entity_id: row.id, via: "tag_ids" });
  }
  return hits;
}

/** 按 list_id 批量软删 task_item（分页直至清空，避免 500 截断） */
export async function deleteTaskItemsByListId(
  world_id: number,
  list_id: number,
  page_size = 200,
): Promise<number> {
  const db = getDb();
  const pageSize = Math.max(1, Math.min(500, page_size));
  const now = new Date();
  let deleted = 0;
  while (true) {
    const rows = await db
      .update(entities)
      .set({ deleted_at: now, updated_at: now })
      .where(
        sql`${entities.id} IN (
          SELECT id FROM ${entities}
          WHERE ${entities.world_id} = ${world_id}
            AND ${entities.primary_component} = 'task_item'
            AND ${entities.body}->>'list_id' = ${String(list_id)}
            AND ${entities.deleted_at} IS NULL
          ORDER BY ${entities.id}
          LIMIT ${pageSize}
        )`,
      )
      .returning({ id: entities.id });
    deleted += rows.length;
    if (rows.length < pageSize) break;
  }
  return deleted;
}

/** 按 account_id 批量软删 email_message / email_thread（仅本地；分页直至清空） */
export async function deleteEmailEntitiesByAccountId(
  world_id: number,
  account_id: number,
  page_size = 200,
): Promise<number> {
  const db = getDb();
  const pageSize = Math.max(1, Math.min(500, page_size));
  const now = new Date();
  let deleted = 0;
  while (true) {
    const rows = await db
      .update(entities)
      .set({ deleted_at: now, updated_at: now })
      .where(
        sql`${entities.id} IN (
          SELECT id FROM ${entities}
          WHERE ${entities.world_id} = ${world_id}
            AND ${entities.primary_component} IN ('email_message', 'email_thread')
            AND ${entities.body}->>'account_id' = ${String(account_id)}
            AND ${entities.deleted_at} IS NULL
          ORDER BY ${entities.id}
          LIMIT ${pageSize}
        )`,
      )
      .returning({ id: entities.id });
    deleted += rows.length;
    if (rows.length < pageSize) break;
  }
  return deleted;
}

function buildListConditions(
  opts?: Omit<EntityListOpts, "offset" | "limit" | "order_by" | "order_dir">,
) {
  const conditions = [];
  const deleted = opts?.deleted ?? "alive";
  if (deleted === "alive") {
    conditions.push(isNull(entities.deleted_at));
  } else if (deleted === "deleted") {
    conditions.push(isNotNull(entities.deleted_at));
  }
  if (opts?.world_id != null) {
    conditions.push(eq(entities.world_id, opts.world_id));
  }
  if (opts?.type != null) {
    conditions.push(eq(entities.type, opts.type));
  }
  if (opts?.types != null && opts.types.length > 0) {
    conditions.push(inArray(entities.type, opts.types));
  }
  if (opts?.primary_component) {
    conditions.push(eq(entities.primary_component, opts.primary_component));
  }
  if (opts?.component) {
    conditions.push(sql`${entities.components} @> ARRAY[${opts.component}]::text[]`);
  }
  if (opts?.empty_shell) {
    conditions.push(sql`cardinality(${entities.components}) = 0`);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function listOrderBy(opts?: EntityListOpts) {
  const dir = opts?.order_dir === "asc" ? asc : desc;
  if (opts?.order_by === "updated_at") return dir(entities.updated_at);
  if (opts?.order_by === "deleted_at") return dir(entities.deleted_at);
  return asc(entities.id);
}

export async function listEntities(
  opts?: EntityListOpts,
  session?: DbSession,
): Promise<EntityRow[]> {
  const db = session ?? getDb();
  const limit = Math.max(1, Math.min(500, opts?.limit ?? 100));
  const offset = Math.max(0, opts?.offset ?? 0);
  const where = buildListConditions(opts);
  const rows = await db
    .select(entityRowSelectColumns)
    .from(entities)
    .where(where)
    .orderBy(listOrderBy(opts))
    .limit(limit)
    .offset(offset);
  return rows.map(mapRow);
}

export async function countEntities(
  opts?: Omit<EntityListOpts, "offset" | "limit" | "order_by" | "order_dir">,
): Promise<number> {
  const db = getDb();
  const where = buildListConditions(opts);
  const [row] = await db.select({ value: count() }).from(entities).where(where);
  return Number(row?.value ?? 0);
}

export async function countEntitiesByBodyListId(listId: number, world_id: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(entities)
    .where(
      and(
        eq(entities.world_id, world_id),
        eq(entities.primary_component, "task_item"),
        isNull(entities.deleted_at),
        sql`${entities.body}->>'list_id' = ${String(listId)}`,
        sql`(${entities.body}->>'project_id' IS NULL OR ${entities.body}->>'project_id' = '')`,
      ),
    );
  return Number(row?.value ?? 0);
}

const pendingTaskItemStatusWhere = sql`COALESCE(${entities.body}->>'status', '') <> ${"completed"}`;

/** 非 completed 的 task_item 计数（与清单 item_count 语义一致；排除项目内任务） */
export async function countPendingTaskItemsByListId(
  listId: number,
  world_id: number,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(entities)
    .where(
      and(
        eq(entities.world_id, world_id),
        eq(entities.primary_component, "task_item"),
        isNull(entities.deleted_at),
        sql`${entities.body}->>'list_id' = ${String(listId)}`,
        sql`(${entities.body}->>'project_id' IS NULL OR ${entities.body}->>'project_id' = '')`,
        pendingTaskItemStatusWhere,
      ),
    );
  return Number(row?.value ?? 0);
}

/** 一次查出 world 内各 list_id 的 pending task 数 */
export async function countPendingTaskItemsGroupedByListId(
  world_id: number,
): Promise<Map<number, number>> {
  const db = getDb();
  const listIdExpr = sql<string>`${entities.body}->>'list_id'`;
  const rows = await db
    .select({
      list_id: listIdExpr,
      value: count(),
    })
    .from(entities)
    .where(
      and(
        eq(entities.world_id, world_id),
        eq(entities.primary_component, "task_item"),
        isNull(entities.deleted_at),
        sql`(${entities.body}->>'project_id' IS NULL OR ${entities.body}->>'project_id' = '')`,
        pendingTaskItemStatusWhere,
      ),
    )
    .groupBy(listIdExpr);

  const map = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.list_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    map.set(id, Number(row.value));
  }
  return map;
}

/** 一次查出 world 内各 project_id 的 pending task 数 */
export async function countPendingTaskItemsGroupedByProjectId(
  world_id: number,
): Promise<Map<number, number>> {
  const db = getDb();
  const projectIdExpr = sql<string>`${entities.body}->>'project_id'`;
  const rows = await db
    .select({
      project_id: projectIdExpr,
      value: count(),
    })
    .from(entities)
    .where(
      and(
        eq(entities.world_id, world_id),
        eq(entities.primary_component, "task_item"),
        isNull(entities.deleted_at),
        sql`${entities.body}->>'project_id' IS NOT NULL`,
        sql`${entities.body}->>'project_id' <> ''`,
        pendingTaskItemStatusWhere,
      ),
    )
    .groupBy(projectIdExpr);

  const map = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row.project_id);
    if (!Number.isFinite(id) || id <= 0) continue;
    map.set(id, Number(row.value));
  }
  return map;
}
