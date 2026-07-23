import { and, eq, sql } from "drizzle-orm";

import { DIARY_ENTRY_COMPONENT, entities } from "@freeanima/core/db/schema";

import { getDb } from "../client.ts";

export type DiaryEntryTagSuggestion = {
  tag: string;
  count: number;
};

/** 本 world 日记实体 body.tags 频次统计；无 query 时取 topN，有 query 时 ILIKE 过滤后按频次 */
export async function suggestDiaryEntryTags(
  worldId: number,
  opts?: { query?: string; limit?: number },
): Promise<DiaryEntryTagSuggestion[]> {
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const query = opts?.query?.trim() ?? "";
  const db = getDb();

  const tagExpr = sql<string>`tag_elem.tag`;
  const countExpr = sql<number>`count(*)::int`;

  const conditions = [
    eq(entities.world_id, worldId),
    eq(entities.primary_component, DIARY_ENTRY_COMPONENT),
    sql`jsonb_typeof(${entities.body}->'tags') = 'array'`,
  ];
  if (query) {
    const escaped = query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    conditions.push(sql`tag_elem.tag ILIKE ${`%${escaped}%`} ESCAPE '\\'`);
  }

  const rows = await db
    .select({
      tag: tagExpr,
      count: countExpr,
    })
    .from(entities)
    .innerJoin(
      sql`LATERAL jsonb_array_elements_text(coalesce(${entities.body}->'tags', '[]'::jsonb)) AS tag_elem(tag)`,
      sql`true`,
    )
    .where(and(...conditions))
    .groupBy(tagExpr)
    .orderBy(sql`count(*) DESC`, sql`tag_elem.tag ASC`)
    .limit(limit);

  return rows
    .map((row) => ({
      tag: String(row.tag ?? "").trim(),
      count: Number(row.count ?? 0),
    }))
    .filter((row) => row.tag.length > 0);
}
