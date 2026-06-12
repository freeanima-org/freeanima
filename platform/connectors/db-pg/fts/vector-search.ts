import { sql as drizzleSql } from "drizzle-orm";

import { getDb } from "../client.ts";
import { formatPgVector } from "../embedding/format.ts";
import type { SemanticMemoryFtsDbRow } from "../semantic-memory/mappers/semantic-mapper.ts";
import { mapSemanticMemoryRow } from "../semantic-memory/mappers/semantic-mapper.ts";
import { messageDocKey, semanticMemoryDocKey } from "@freeanima/core/util";
import { pgSemanticSourceSessionsFilter, pgSemanticTypeFilter } from "../utils/pg-sql.ts";

export type VectorSemanticHit = SemanticMemoryFtsDbRow & { docKey: string };

export async function searchSemanticMemoryVector(
  queryEmbedding: number[],
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    sourceSessions?: string[];
  },
): Promise<VectorSemanticHit[]> {
  if (!queryEmbedding.length) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const sourceSessions = opts?.sourceSessions?.map((s) => s.trim()).filter(Boolean) ?? [];
  const queryVec = formatPgVector(queryEmbedding);

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
      1 - (sm.content_embedding <=> ${queryVec}::vector) AS rank
    FROM semantic_memory sm
    WHERE sm.content_embedding IS NOT NULL
    ${statusFilter}
    ${typeFilter}
    ${sourceFilter}
    ORDER BY sm.content_embedding <=> ${queryVec}::vector
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    ...mapSemanticMemoryRow(r),
    docKey: semanticMemoryDocKey(r.id),
    rank: Number(r.rank),
  }));
}

export type VectorMessageHit = {
  id: string;
  content: string;
  role: string;
  session_id: string;
  timestamp: string;
  docKey: string;
  rank: number;
};

export async function searchMessagesVector(
  queryEmbedding: number[],
  opts?: { sessionId?: string; limit?: number },
): Promise<VectorMessageHit[]> {
  if (!queryEmbedding.length) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const sessionId = opts?.sessionId?.trim() || null;
  const queryVec = formatPgVector(queryEmbedding);

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
      1 - (m.content_embedding <=> ${queryVec}::vector) AS rank
    FROM messages m
    WHERE m.content_embedding IS NOT NULL
      AND m.content_fts IS NOT NULL
      AND NOT m.session_id LIKE 'debug-%'
      AND (${sessionId}::text IS NULL OR m.session_id = ${sessionId})
    ORDER BY m.content_embedding <=> ${queryVec}::vector
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    role: r.role,
    session_id: r.session_id,
    timestamp: r.timestamp ?? "",
    docKey: messageDocKey(r.id),
    rank: Number(r.rank),
  }));
}
