import { and, eq, sql } from "drizzle-orm";

import { TAG_COMPONENT, entities } from "@freeanima/habitat/core/db/schema";

import { getDb } from "../client.ts";

export type TagSuggestion = {
  id: number;
  title: string;
  count: number;
};

/**
 * 外层 tag 行的 id。必须写死 schema 限定名：
 * 放进 SELECT 相关子查询时，`${entities.id}` 会被展成未限定 `"id"`，
 * 在 `FROM entities AS d` 内会错误绑定到 d.id，导致 count 恒为 0。
 */
const OUTER_TAG_ID = sql.raw(`"entities"."id"`);

/** 本 world 指定 primary_component 实体 tag_ids 引用频次；无 query 时 topN，有 query 时 ILIKE title */
export async function suggestTagsByPrimaryComponent(
  worldId: number,
  primaryComponent: string,
  opts?: { query?: string; limit?: number },
): Promise<TagSuggestion[]> {
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const query = opts?.query?.trim() ?? "";
  const db = getDb();

  const conditions = [
    eq(entities.world_id, worldId),
    eq(entities.primary_component, TAG_COMPONENT),
    sql`EXISTS (
      SELECT 1 FROM ${entities} AS d
      WHERE d.world_id = ${worldId}
        AND d.primary_component = ${primaryComponent}
        AND d.tag_ids @> ARRAY[${OUTER_TAG_ID}]::bigint[]
    )`,
  ];
  if (query) {
    const escaped = query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    conditions.push(sql`${entities.title} ILIKE ${`%${escaped}%`} ESCAPE '\\'`);
  }

  const countExpr = sql<number>`(
    SELECT count(*)::int FROM ${entities} AS d
    WHERE d.world_id = ${worldId}
      AND d.primary_component = ${primaryComponent}
      AND d.tag_ids @> ARRAY[${OUTER_TAG_ID}]::bigint[]
  )`;

  const rows = await db
    .select({
      id: entities.id,
      title: entities.title,
      count: countExpr,
    })
    .from(entities)
    .where(and(...conditions))
    .orderBy(
      sql`(
      SELECT count(*) FROM ${entities} AS d
      WHERE d.world_id = ${worldId}
        AND d.primary_component = ${primaryComponent}
        AND d.tag_ids @> ARRAY[${OUTER_TAG_ID}]::bigint[]
    ) DESC`,
      sql`${entities.title} ASC`,
    )
    .limit(limit);

  return rows
    .map((row) => ({
      id: row.id,
      title: (row.title ?? "").trim(),
      count: row.count ?? 0,
    }))
    .filter((row) => row.id > 0 && row.title.length > 0 && row.count > 0);
}
