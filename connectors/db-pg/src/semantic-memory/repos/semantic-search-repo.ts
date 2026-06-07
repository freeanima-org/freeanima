import { sql as drizzleSql } from "drizzle-orm";
import type { SemanticFtsHit, SemanticMemorySearchOpts } from "@freeanima/engine-repos";

import { getDb } from "../../client.ts";
import { buildPgTsQuery } from "../../session/fts-query.ts";
import { mapSemanticMemoryRow, type SemanticMemoryDbRow } from "../mappers/semantic-mapper.ts";

export async function searchSemanticMemory(
  opts: SemanticMemorySearchOpts,
): Promise<SemanticFtsHit[]> {
  const limit = Math.max(1, Math.min(50, opts.limit ?? 10));
  const types = opts.types?.filter(Boolean) ?? [];
  const status = opts.status ?? "active";
  const sourceSessions = opts.source_sessions?.map((s: string) => s.trim()).filter(Boolean) ?? [];

  const db = getDb();
  const typeFilter =
    types.length > 0 ? drizzleSql`AND sm.type = ANY(${types}::text[])` : drizzleSql``;
  const statusFilter = status === "all" ? drizzleSql`` : drizzleSql`AND sm.status = ${status}`;
  const sourceFilter =
    sourceSessions.length > 0
      ? drizzleSql`AND sm.source_sessions && ${sourceSessions}::text[]`
      : drizzleSql``;

  const q = opts.query?.trim() ?? "";
  if (q) {
    const tsquery = buildPgTsQuery(q);
    if (!tsquery) return [];
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
        ts_rank(sm.content_fts, q) AS rank
      FROM semantic_memory sm,
           to_tsquery('simple', ${tsquery}) q
      WHERE sm.content_fts @@ q
      ${typeFilter}
      ${statusFilter}
      ${sourceFilter}
      ORDER BY rank DESC
      LIMIT ${limit}
    `);
    return rows.map((r) => ({
      ...mapSemanticMemoryRow(r),
      rank: Number(r.rank),
    }));
  }

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
      1.0 AS rank
    FROM semantic_memory sm
    WHERE true
    ${typeFilter}
    ${statusFilter}
    ${sourceFilter}
    ORDER BY sm.updated DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    ...mapSemanticMemoryRow(r),
    rank: Number(r.rank),
  }));
}
