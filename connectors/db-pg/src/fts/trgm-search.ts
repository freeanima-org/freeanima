import { sql as drizzleSql } from "drizzle-orm";
import { getActiveConfig, getFtsTrgmMinSimilarity } from "@freeanima/service-config";

import { getDb } from "../client.ts";
import type { SemanticMemoryDbRow } from "../semantic-memory/mappers/semantic-mapper.ts";
import { messageDocKey, semanticMemoryDocKey } from "@freeanima/storage-util";
import { pgSemanticSourceSessionsFilter, pgSemanticTypeFilter } from "../utils/pg-sql.ts";

export type TrgmSemanticHit = SemanticMemoryDbRow & { docKey: string; rank: number };

export async function searchSemanticMemoryTrgm(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    sourceSessions?: string[];
  },
): Promise<TrgmSemanticHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveConfig().data);
  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const sourceSessions = opts?.sourceSessions?.map((s) => s.trim()).filter(Boolean) ?? [];

  const db = getDb();
  const typeFilter = pgSemanticTypeFilter(types);
  const statusFilter = status === "all" ? drizzleSql`` : drizzleSql`AND sm.status = ${status}`;
  const sourceFilter = pgSemanticSourceSessionsFilter(sourceSessions);

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
      sm.reference_count,
      sm.created,
      sm.updated,
      similarity(sm.content, ${q}) AS rank
    FROM semantic_memory sm
    WHERE word_similarity(sm.content, ${q}) >= ${minSim}
    ${statusFilter}
    ${typeFilter}
    ${sourceFilter}
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    ...r,
    docKey: semanticMemoryDocKey(r.id),
    rank: Number(r.rank),
  }));
}

export type TrgmMessageHit = {
  id: string;
  content: string;
  role: string;
  session_id: string;
  timestamp: string;
  docKey: string;
  rank: number;
};

export async function searchMessagesTrgm(
  query: string,
  opts?: { sessionId?: string; limit?: number },
): Promise<TrgmMessageHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const minSim = getFtsTrgmMinSimilarity(getActiveConfig().data);
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
      similarity(m.payload->>'content', ${q}) AS rank
    FROM messages m
    WHERE m.content_fts IS NOT NULL
      AND word_similarity(m.payload->>'content', ${q}) >= ${minSim}
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
    docKey: messageDocKey(r.id),
    rank: Number(r.rank),
  }));
}
