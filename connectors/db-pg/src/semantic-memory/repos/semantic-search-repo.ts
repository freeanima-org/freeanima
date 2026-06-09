import { sql as drizzleSql } from "drizzle-orm";
import type { SemanticFtsHit, SemanticMemorySearchOpts } from "@freeanima/engine-repos";

import { getDb } from "../../client.ts";
import { buildPgTsQuery } from "../../session/fts-query.ts";
import { mapSemanticMemoryRow, type SemanticMemoryDbRow } from "../mappers/semantic-mapper.ts";

type SemanticSearchFilterOpts = Omit<SemanticMemorySearchOpts, "limit" | "offset">;

function normalizeSearchOpts(opts: SemanticSearchFilterOpts) {
  const types = opts.types?.filter(Boolean) ?? [];
  const status = opts.status ?? "active";
  const sourceSessions = opts.source_sessions?.map((s: string) => s.trim()).filter(Boolean) ?? [];
  const q = opts.query?.trim() ?? "";
  return { types, status, sourceSessions, q };
}

function buildSemanticFilters(
  types: string[],
  status: "active" | "deprecated" | "all",
  sourceSessions: string[],
) {
  const typeFilter =
    types.length === 0
      ? drizzleSql``
      : types.length === 1
        ? drizzleSql`AND sm.type = ${types[0]}`
        : drizzleSql`AND sm.type = ANY(${types}::text[])`;
  const statusFilter = status === "all" ? drizzleSql`` : drizzleSql`AND sm.status = ${status}`;
  const sourceFilter =
    sourceSessions.length > 0
      ? drizzleSql`AND sm.source_sessions && ${sourceSessions}::text[]`
      : drizzleSql``;
  return { typeFilter, statusFilter, sourceFilter };
}

export async function searchSemanticMemory(
  opts: SemanticMemorySearchOpts,
): Promise<SemanticFtsHit[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 10));
  const offset = Math.max(0, opts.offset ?? 0);
  const { types, status, sourceSessions, q } = normalizeSearchOpts(opts);
  const { typeFilter, statusFilter, sourceFilter } = buildSemanticFilters(
    types,
    status,
    sourceSessions,
  );

  const db = getDb();
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
      OFFSET ${offset}
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
    OFFSET ${offset}
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    ...mapSemanticMemoryRow(r),
    rank: Number(r.rank),
  }));
}

export async function countSemanticMemorySearch(opts: SemanticSearchFilterOpts): Promise<number> {
  const { types, status, sourceSessions, q } = normalizeSearchOpts(opts);
  const { typeFilter, statusFilter, sourceFilter } = buildSemanticFilters(
    types,
    status,
    sourceSessions,
  );

  const db = getDb();
  if (q) {
    const tsquery = buildPgTsQuery(q);
    if (!tsquery) return 0;
    const rows = await db.execute<{ n: number }>(drizzleSql`
      SELECT count(*)::int AS n
      FROM semantic_memory sm,
           to_tsquery('simple', ${tsquery}) q
      WHERE sm.content_fts @@ q
      ${typeFilter}
      ${statusFilter}
      ${sourceFilter}
    `);
    return Number(rows[0]?.n ?? 0);
  }

  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n
    FROM semantic_memory sm
    WHERE true
    ${typeFilter}
    ${statusFilter}
    ${sourceFilter}
  `);
  return Number(rows[0]?.n ?? 0);
}
