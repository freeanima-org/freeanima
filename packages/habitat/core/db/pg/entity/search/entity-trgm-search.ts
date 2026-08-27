import { and, desc, sql } from "drizzle-orm";
import { entities } from "@freeanima/habitat/core/db/schema";
import { entityRowSelectColumns, mapEntityRow } from "@freeanima/habitat/core/db/schema/entity";
import { entityDocKey } from "@freeanima/habitat/core/util";
import { getActiveRuntimeConfig, getFtsTrgmMinSimilarity } from "@freeanima/habitat/core/config";
import type { EntitySearchOpts } from "../types.ts";

import { getDb } from "../../client.ts";
import { buildEntitySearchWhere, entitySearchableTextExprForTrgm } from "./conditions.ts";

export type EntityTrgmHit = ReturnType<typeof mapEntityRow> & { docKey: string; rank: number };

export async function searchEntitiesTrgm(
  query: string,
  opts: EntitySearchOpts & { limit?: number },
): Promise<EntityTrgmHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveRuntimeConfig().data);
  const searchText = entitySearchableTextExprForTrgm(opts);

  const db = getDb();
  const rankExpr = sql<number>`similarity(${searchText}, ${q})`.as("rank");
  const where = buildEntitySearchWhere(opts);
  const conditions = [
    sql`word_similarity(${searchText}, ${q}) >= ${minSim}`,
    ...(where ? [where] : []),
  ];

  const rows = await db
    .select({
      ...entityRowSelectColumns,
      rank: rankExpr,
    })
    .from(entities)
    .where(and(...conditions))
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    ...mapEntityRow(r),
    docKey: entityDocKey(r.id),
    rank: r.rank,
  }));
}
