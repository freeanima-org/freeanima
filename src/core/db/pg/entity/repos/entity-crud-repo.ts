import { and, count, eq, inArray, sql } from "drizzle-orm";
import { entities, entityTypeSchema } from "@freeanima/core/db/schema";
import {
  mergeComponentBody,
  mapEntityRow,
  entityRowSelectColumns,
  primaryComponentSchema,
  validateEntityBody,
  entitySearchTextForWrite,
  type EntityRowSelect,
} from "@freeanima/core/db/schema/entity";
import type { EntityCreateInput, EntityListOpts, EntityRow, EntityUpdateInput } from "../types.ts";

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

export async function getEntity(id: number): Promise<EntityRow | null> {
  const db = getDb();
  const [row] = await db
    .select(entityRowSelectColumns)
    .from(entities)
    .where(eq(entities.id, id))
    .limit(1);
  return row ? mapRow(row) : null;
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
  if (input.pinned !== undefined) patch.pinned = input.pinned;
  if (input.reference_count !== undefined) patch.reference_count = input.reference_count;
  if (input.tag_ids !== undefined) patch.tag_ids = input.tag_ids;

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

export async function deleteEntity(id: number): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(entities)
    .where(eq(entities.id, id))
    .returning({ id: entities.id });
  return result.length > 0;
}

/** 按 list_id 批量删除 task_item（分页直至清空，避免 500 截断） */
export async function deleteTaskItemsByListId(
  world_id: number,
  list_id: number,
  page_size = 200,
): Promise<number> {
  const db = getDb();
  const pageSize = Math.max(1, Math.min(500, page_size));
  let deleted = 0;
  while (true) {
    const rows = await db
      .delete(entities)
      .where(
        sql`${entities.id} IN (
          SELECT id FROM ${entities}
          WHERE ${entities.world_id} = ${world_id}
            AND ${entities.primary_component} = 'task_item'
            AND ${entities.body}->>'list_id' = ${String(list_id)}
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

/** 按 account_id 批量删除 email_message / email_thread（仅本地；分页直至清空） */
export async function deleteEmailEntitiesByAccountId(
  world_id: number,
  account_id: number,
  page_size = 200,
): Promise<number> {
  const db = getDb();
  const pageSize = Math.max(1, Math.min(500, page_size));
  let deleted = 0;
  while (true) {
    const rows = await db
      .delete(entities)
      .where(
        sql`${entities.id} IN (
          SELECT id FROM ${entities}
          WHERE ${entities.world_id} = ${world_id}
            AND ${entities.primary_component} IN ('email_message', 'email_thread')
            AND ${entities.body}->>'account_id' = ${String(account_id)}
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

function buildListConditions(opts?: Omit<EntityListOpts, "offset" | "limit">) {
  const conditions = [];
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
  return conditions.length > 0 ? and(...conditions) : undefined;
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
    .orderBy(entities.id)
    .limit(limit)
    .offset(offset);
  return rows.map(mapRow);
}

export async function countEntities(
  opts?: Omit<EntityListOpts, "offset" | "limit">,
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
