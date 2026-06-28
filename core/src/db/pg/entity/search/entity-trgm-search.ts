import { and, desc, getColumns, sql } from "drizzle-orm";
import { entities } from "@freeanima/core/db/schema";
import { mapEntityRow } from "@freeanima/core/db/schema/entity";
import { entityDocKey } from "@freeanima/core/util";
import { getActiveConfig, getFtsTrgmMinSimilarity } from "@freeanima/core/config";
import type { EntitySearchOpts } from "../types.ts";

import { getDb } from "../../client.ts";
import { buildEntitySearchWhere } from "./conditions.ts";

export type EntityTrgmHit = ReturnType<typeof mapEntityRow> & { docKey: string; rank: number };

export async function searchEntitiesTrgm(
  query: string,
  opts: EntitySearchOpts & { limit?: number },
): Promise<EntityTrgmHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveConfig().data);
  const searchText = sql<string>`btrim(
    coalesce(${entities.title}, '') || ' ' ||
    coalesce(${entities.summary}, '') || ' ' ||
    coalesce(${entities.content}, '')
  )`;

  const db = getDb();
  const rankExpr = sql<number>`similarity(${searchText}, ${q})`.as("rank");
  const where = buildEntitySearchWhere(opts);
  const conditions = [
    sql`word_similarity(${searchText}, ${q}) >= ${minSim}`,
    ...(where ? [where] : []),
  ];

  const rows = await db
    .select({
      ...getColumns(entities),
      rank: rankExpr,
    })
    .from(entities)
    .where(and(...conditions))
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    ...mapEntityRow(r),
    docKey: entityDocKey(r.id),
    rank: Number(r.rank),
  }));
}
