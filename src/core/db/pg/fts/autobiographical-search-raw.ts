import { and, desc, eq, getColumns, sql } from "drizzle-orm";
import { getActiveRuntimeConfig, getFtsTrgmMinSimilarity } from "@freeanima/core/config";
import { autobiographicalDocKey } from "@freeanima/core/util";
import { autobiographicalMemory } from "@freeanima/core/db/schema";
import type { AutobiographicalStatus } from "@freeanima/core/db/pg/autobiographical-memory/types";

import { getDb } from "../client.ts";
import { buildFtsTsQuery } from "./query.ts";

export type AutobiographicalMemoryFtsDbRow = typeof autobiographicalMemory.$inferSelect & {
  rank: number;
};

const autobiographicalBodySql = sql<string>`btrim(${autobiographicalMemory.title}) || E'\\n' || btrim(${autobiographicalMemory.content})`;

function statusCondition(status: AutobiographicalStatus) {
  return eq(autobiographicalMemory.status, status);
}

export async function searchAutobiographicalMemoryFtsRaw(
  query: string,
  opts?: { limit?: number; status?: AutobiographicalStatus },
): Promise<AutobiographicalMemoryFtsDbRow[]> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const status = opts?.status ?? "active";
  const db = getDb();
  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const rankExpr =
    sql<number>`ts_rank_cd(${autobiographicalMemory.content_fts}, ${tsqueryExpr}, 32)`.as("rank");

  const rows = await db
    .select({
      ...getColumns(autobiographicalMemory),
      rank: rankExpr,
    })
    .from(autobiographicalMemory)
    .where(
      and(sql`${autobiographicalMemory.content_fts} @@ ${tsqueryExpr}`, statusCondition(status)),
    )
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
}

export type TrgmAutobiographicalHit = typeof autobiographicalMemory.$inferSelect & {
  docKey: string;
  rank: number;
};

export async function searchAutobiographicalMemoryTrgm(
  query: string,
  opts?: { limit?: number; status?: AutobiographicalStatus },
): Promise<TrgmAutobiographicalHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const status = opts?.status ?? "active";
  const minSim = getFtsTrgmMinSimilarity(getActiveRuntimeConfig().data);
  const db = getDb();
  const rankExpr = sql<number>`similarity(${autobiographicalBodySql}, ${q})`.as("rank");

  const rows = await db
    .select({
      ...getColumns(autobiographicalMemory),
      rank: rankExpr,
    })
    .from(autobiographicalMemory)
    .where(
      and(
        sql`word_similarity(${autobiographicalBodySql}, ${q}) >= ${minSim}`,
        statusCondition(status),
      ),
    )
    .orderBy(desc(rankExpr))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    docKey: autobiographicalDocKey(r.id),
    rank: Number(r.rank),
  }));
}
