import { and, eq, sql } from "drizzle-orm";

import { DIARY_ENTRY_COMPONENT, TAG_COMPONENT, entities } from "@freeanima/core/db/schema";

import { getDb } from "../client.ts";

export type DiaryEntryTagSuggestion = {
  id: number;
  title: string;
  count: number;
};

/** 本 world 日记实体 tag_ids 引用频次；无 query 时 topN，有 query 时 ILIKE title */
export async function suggestDiaryEntryTags(
  worldId: number,
  opts?: { query?: string; limit?: number },
): Promise<DiaryEntryTagSuggestion[]> {
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const query = opts?.query?.trim() ?? "";
  const db = getDb();

  const conditions = [
    eq(entities.world_id, worldId),
    eq(entities.primary_component, TAG_COMPONENT),
    sql`EXISTS (
      SELECT 1 FROM ${entities} AS d
      WHERE d.world_id = ${worldId}
        AND d.primary_component = ${DIARY_ENTRY_COMPONENT}
        AND d.tag_ids @> ARRAY[${entities.id}]::bigint[]
    )`,
  ];
  if (query) {
    const escaped = query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    conditions.push(sql`${entities.title} ILIKE ${`%${escaped}%`} ESCAPE '\\'`);
  }

  const countExpr = sql<number>`(
    SELECT count(*)::int FROM ${entities} AS d
    WHERE d.world_id = ${worldId}
      AND d.primary_component = ${DIARY_ENTRY_COMPONENT}
      AND d.tag_ids @> ARRAY[${entities.id}]::bigint[]
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
        AND d.primary_component = ${DIARY_ENTRY_COMPONENT}
        AND d.tag_ids @> ARRAY[${entities.id}]::bigint[]
    ) DESC`,
      sql`${entities.title} ASC`,
    )
    .limit(limit);

  return rows
    .map((row) => ({
      id: Number(row.id),
      title: String(row.title ?? "").trim(),
      count: Number(row.count ?? 0),
    }))
    .filter((row) => row.id > 0 && row.title.length > 0 && row.count > 0);
}
