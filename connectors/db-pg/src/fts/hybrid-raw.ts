import { sql as drizzleSql } from "drizzle-orm";

import { getDb } from "../client.ts";
import { buildFtsTsQuery } from "./query.ts";
import {
  mapSemanticMemoryRow,
  type SemanticMemoryFtsDbRow,
} from "../semantic-memory/mappers/semantic-mapper.ts";
import { pgSemanticSourceSessionsFilter, pgSemanticTypeFilter } from "../utils/pg-sql.ts";

export async function searchSemanticMemoryFtsRaw(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    sourceSessions?: string[];
  },
): Promise<SemanticMemoryFtsDbRow[]> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const sourceSessions = opts?.sourceSessions?.map((s) => s.trim()).filter(Boolean) ?? [];

  const db = getDb();
  const typeFilter = pgSemanticTypeFilter(types);
  const statusFilter = status === "all" ? drizzleSql`` : drizzleSql`AND sm.status = ${status}`;
  const sourceFilter = pgSemanticSourceSessionsFilter(sourceSessions);

  const rows = await db.execute<SemanticMemoryFtsDbRow>(drizzleSql`
    SELECT
      sm.id,
      sm.type,
      sm.pinned,
      sm.content,
      sm.source_sessions,
      sm.observed_at,
      sm.occurred_at,
      sm.status,
      sm.reference_count,
      sm.created,
      sm.updated,
      ts_rank_cd(sm.content_fts, q, 32) AS rank
    FROM semantic_memory sm,
         to_tsquery('simple', ${tsquery}) q
    WHERE sm.content_fts @@ q
    ${statusFilter}
    ${typeFilter}
    ${sourceFilter}
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({ ...mapSemanticMemoryRow(r), rank: Number(r.rank) }));
}

export async function searchMessagesFtsRaw(
  query: string,
  opts?: { sessionId?: string; limit?: number },
): Promise<
  Array<{
    id: string;
    content: string;
    role: string;
    session_id: string;
    timestamp: string;
    rank: number;
  }>
> {
  const q = query.trim();
  if (!q) return [];

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const sessionId = opts?.sessionId?.trim() || null;

  const db = getDb();
  const rows = await db.execute<{
    id: string;
    content: string;
    role: string;
    session_id: string;
    timestamp: string;
    rank: number;
  }>(drizzleSql`
    SELECT
      m.id,
      m.payload->>'content' AS content,
      m.payload->>'role' AS role,
      m.session_id,
      m.payload->>'timestamp' AS timestamp,
      ts_rank_cd(m.content_fts, q, 32) AS rank
    FROM messages m,
         to_tsquery('simple', ${tsquery}) q
    WHERE m.content_fts @@ q
      AND NOT m.session_id LIKE 'debug-%'
      AND (${sessionId}::text IS NULL OR m.session_id = ${sessionId})
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    role: r.role,
    session_id: r.session_id,
    timestamp: r.timestamp ?? "",
    rank: Number(r.rank),
  }));
}
