import { sql as drizzleSql } from "drizzle-orm";
import type { SemanticFtsHit } from "@freeanima/engine-repos";

import { getDb } from "../../client.ts";
import { buildPgTsQuery } from "../../session/fts-query.ts";
import { mapSemanticMemoryRow, type SemanticMemoryDbRow } from "../mappers/semantic-mapper.ts";

export async function searchSemanticMemoryFts(
  query: string,
  opts?: { limit?: number; types?: string[] },
): Promise<SemanticFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = buildPgTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const types = opts?.types?.filter(Boolean) ?? [];

  const db = getDb();
  const typeFilter =
    types.length > 0 ? drizzleSql`AND sm.type = ANY(${types}::text[])` : drizzleSql``;
  const rows = await db.execute<SemanticMemoryDbRow & { rank: number }>(drizzleSql`
    SELECT
      sm.id,
      sm.type,
      sm.pinned,
      sm.content,
      sm.source_sessions,
      sm.observed_at,
      sm.occurred_at,
      sm.status,
      sm.created,
      sm.updated,
      ts_rank_cd(sm.content_fts, q, 32) AS rank
    FROM semantic_memory sm,
         to_tsquery('simple', ${tsquery}) q
    WHERE sm.content_fts @@ q
      AND sm.status = 'active'
    ${typeFilter}
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    ...mapSemanticMemoryRow(r),
    rank: Number(r.rank),
  }));
}
