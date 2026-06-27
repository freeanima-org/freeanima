import { and, asc, getColumns, isNotNull, sql } from "drizzle-orm";
import { entities } from "@freeanima/core/db/schema";
import { mapEntityRow } from "@freeanima/core/db/schema/entity";
import { entityDocKey } from "@freeanima/core/util";
import type { EntitySearchOpts } from "@freeanima/core/repos";

import { formatPgVector } from "../../embedding/format.ts";
import { getDb } from "../../client.ts";
import { buildEntitySearchWhere } from "./conditions.ts";

export type EntityVectorHit = ReturnType<typeof mapEntityRow> & { docKey: string; rank: number };

export async function searchEntitiesVector(
  queryEmbedding: number[],
  opts: EntitySearchOpts & { limit?: number },
): Promise<EntityVectorHit[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const db = getDb();
  const queryVec = formatPgVector(queryEmbedding);
  const distanceExpr = sql`${entities.searchEmbedding} <=> ${queryVec}::vector`;
  const rankExpr = sql<number>`(1 - (${distanceExpr}))`.as("rank");
  const where = buildEntitySearchWhere(opts);
  const conditions = [isNotNull(entities.searchEmbedding), ...(where ? [where] : [])];

  const rows = await db
    .select({
      ...getColumns(entities),
      rank: rankExpr,
    })
    .from(entities)
    .where(and(...conditions))
    .orderBy(asc(distanceExpr))
    .limit(limit);

  return rows.map((r) => ({
    ...mapEntityRow(r),
    docKey: entityDocKey(r.id),
    rank: Number(r.rank),
  }));
}
