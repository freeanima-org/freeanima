import type { MessageFtsHit, SemanticFtsHit } from "@freeanima/engine-repos";
import { getFtsTrgmFallbackWhenHitsLt, getFtsTrgmMinSimilarity } from "@freeanima/service-config";
import { sql as drizzleSql } from "drizzle-orm";

import { getDb } from "../client.ts";
import { buildFtsTsQuery } from "./query.ts";
import { rrfMerge, messageDocKey, semanticMemoryDocKey } from "./rrf.ts";
import { searchMessagesTrgm, searchSemanticMemoryTrgm } from "./trgm-search.ts";
import { searchSemanticMemoryFtsRaw, searchMessagesFtsRaw } from "./hybrid-raw.ts";
import { mapSemanticMemoryRow } from "../semantic-memory/mappers/semantic-mapper.ts";

function buildTypeFilter(types: string[]) {
  if (types.length === 0) return drizzleSql``;
  if (types.length === 1) return drizzleSql`AND sm.type = ${types[0]}`;
  return drizzleSql`AND sm.type = ANY(${types}::text[])`;
}

function candidateLimit(requested: number, ftsCount: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt();
  const base = Math.max(requested * 3, 20);
  if (fallback > 0 && ftsCount < fallback) {
    return Math.max(base, requested * 5);
  }
  return base;
}

export async function hybridSearchSemanticMemory(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    offset?: number;
    sourceSessions?: string[];
  },
): Promise<SemanticFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const offset = Math.max(0, opts?.offset ?? 0);
  const fetchLimit = limit + offset;

  const ftsHits = await searchSemanticMemoryFtsRaw(q, {
    limit: candidateLimit(fetchLimit, 0),
    types: opts?.types,
    status: opts?.status,
    sourceSessions: opts?.sourceSessions,
  });
  const pool = candidateLimit(fetchLimit, ftsHits.length);
  const trgmHits = await searchSemanticMemoryTrgm(q, {
    limit: pool,
    types: opts?.types,
    status: opts?.status,
    sourceSessions: opts?.sourceSessions,
  });

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: semanticMemoryDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));

  const merged = rrfMerge([ftsRanked, trgmRanked], { limit: pool });
  return merged.slice(offset, offset + limit).map((row) => ({
    ...mapSemanticMemoryRow(row),
    rank: row.rank,
  }));
}

export async function hybridSearchMessages(
  query: string,
  opts?: { sessionId?: string; limit?: number },
): Promise<MessageFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));

  const ftsHits = await searchMessagesFtsRaw(q, { ...opts, limit: candidateLimit(limit, 0) });
  const pool = candidateLimit(limit, ftsHits.length);
  const trgmHits = await searchMessagesTrgm(q, { ...opts, limit: pool });

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: messageDocKey(h.id) }));
  const merged = rrfMerge([ftsRanked, trgmHits], { limit: pool });

  return merged.slice(0, limit).map((row) => ({
    content: row.content,
    role: row.role,
    session_id: row.session_id,
    timestamp: row.timestamp,
    rank: row.rank,
  }));
}

export async function hybridCountSemanticMemory(
  query: string,
  opts?: {
    types?: string[];
    status?: "active" | "deprecated" | "all";
    sourceSessions?: string[];
  },
): Promise<number> {
  const q = query.trim();
  if (!q) return 0;

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return 0;

  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const sourceSessions = opts?.sourceSessions?.map((s) => s.trim()).filter(Boolean) ?? [];
  const minSim = getFtsTrgmMinSimilarity();

  const db = getDb();
  const typeFilter = buildTypeFilter(types);
  const statusFilter = status === "all" ? drizzleSql`` : drizzleSql`AND sm.status = ${status}`;
  const sourceFilter =
    sourceSessions.length > 0
      ? drizzleSql`AND sm.source_sessions && ${sourceSessions}::text[]`
      : drizzleSql``;

  const rows = await db.execute<{ n: number }>(drizzleSql`
    SELECT count(*)::int AS n FROM (
      SELECT sm.id
      FROM semantic_memory sm, to_tsquery('simple', ${tsquery}) q
      WHERE sm.content_fts @@ q
      ${statusFilter}
      ${typeFilter}
      ${sourceFilter}
      UNION
      SELECT sm.id
      FROM semantic_memory sm
      WHERE word_similarity(sm.content, ${q}) >= ${minSim}
      ${statusFilter}
      ${typeFilter}
      ${sourceFilter}
    ) merged
  `);
  return Number(rows[0]?.n ?? 0);
}
