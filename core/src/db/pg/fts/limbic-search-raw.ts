import { asc, desc, getColumns, isNotNull, sql } from "drizzle-orm";
import { getActiveConfig, getFtsTrgmMinSimilarity } from "@freeanima/core/config";
import { limbicDocKey } from "@freeanima/core/util";
import { limbicMemory } from "@freeanima/core/db/schema";

import { formatPgVector } from "../embedding/format.ts";
import { getDb } from "../client.ts";
import { buildFtsTsQuery } from "./query.ts";

export type LimbicMemoryFtsDbRow = typeof limbicMemory.$inferSelect & { rank: number };

export async function searchLimbicMemoryFtsRaw(
  query: string,
  opts?: { limit?: number },
): Promise<LimbicMemoryFtsDbRow[]> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const db = getDb();
  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const rankExpr = sql<number>`ts_rank_cd(${limbicMemory.content_fts}, ${tsqueryExpr}, 32)`.as(
    "rank",
  );

  const rows = await db
    .select({
      ...getColumns(limbicMemory),
      rank: rankExpr,
    })
    .from(limbicMemory)
    .where(sql`${limbicMemory.content_fts} @@ ${tsqueryExpr}`)
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
}

export type TrgmLimbicHit = typeof limbicMemory.$inferSelect & {
  docKey: string;
  rank: number;
};

export async function searchLimbicMemoryTrgm(
  query: string,
  opts?: { limit?: number },
): Promise<TrgmLimbicHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveConfig().data);
  const db = getDb();
  const rankExpr = sql<number>`similarity(${limbicMemory.content}, ${q})`.as("rank");

  const rows = await db
    .select({
      ...getColumns(limbicMemory),
      rank: rankExpr,
    })
    .from(limbicMemory)
    .where(sql`word_similarity(${limbicMemory.content}, ${q}) >= ${minSim}`)
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    docKey: limbicDocKey(r.id),
    rank: Number(r.rank),
  }));
}

export type VectorLimbicHit = typeof limbicMemory.$inferSelect & {
  docKey: string;
  rank: number;
};

export async function searchLimbicMemoryVector(
  queryEmbedding: number[],
  opts?: { limit?: number },
): Promise<VectorLimbicHit[]> {
  if (!queryEmbedding.length) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const queryVec = formatPgVector(queryEmbedding);
  const db = getDb();
  const distanceExpr = sql`${limbicMemory.content_embedding} <=> ${queryVec}::vector`;
  const rankExpr = sql<number>`1 - (${distanceExpr})`.as("rank");

  const rows = await db
    .select({
      ...getColumns(limbicMemory),
      rank: rankExpr,
    })
    .from(limbicMemory)
    .where(isNotNull(limbicMemory.content_embedding))
    .orderBy(asc(distanceExpr))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    docKey: limbicDocKey(r.id),
    rank: Number(r.rank),
  }));
}
