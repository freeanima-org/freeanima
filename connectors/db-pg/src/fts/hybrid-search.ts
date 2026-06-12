import type { MessageFtsHit, SemanticFtsHit } from "@freeanima/storage-repos";
import {
  getActiveConfig,
  getFtsTrgmFallbackWhenHitsLt,
  getFtsTrgmMinSimilarity,
} from "@freeanima/service-config";
import { sql as drizzleSql } from "drizzle-orm";

import { embedQueryText } from "../embedding/query.ts";
import { getDb } from "../client.ts";
import { buildFtsTsQuery } from "./query.ts";
import { rrfMerge, messageDocKey, semanticMemoryDocKey } from "@freeanima/storage-util";
import { searchMessagesTrgm, searchSemanticMemoryTrgm } from "./trgm-search.ts";
import { searchSemanticMemoryFtsRaw, searchMessagesFtsRaw } from "./hybrid-raw.ts";
import { searchMessagesVector, searchSemanticMemoryVector } from "./vector-search.ts";
import { mapSemanticMemoryRow } from "../semantic-memory/mappers/semantic-mapper.ts";
import { pgSemanticSourceSessionsFilter, pgSemanticTypeFilter } from "../utils/pg-sql.ts";

function candidateLimit(requested: number, ftsCount: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveConfig().data);
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

  const queryEmbedding = await embedQueryText(q);

  const ftsHits = await searchSemanticMemoryFtsRaw(q, {
    limit: candidateLimit(fetchLimit, 0),
    types: opts?.types,
    status: opts?.status,
    sourceSessions: opts?.sourceSessions,
  });
  const pool = candidateLimit(fetchLimit, ftsHits.length);
  const [trgmHits, vectorHits] = await Promise.all([
    searchSemanticMemoryTrgm(q, {
      limit: pool,
      types: opts?.types,
      status: opts?.status,
      sourceSessions: opts?.sourceSessions,
    }),
    queryEmbedding
      ? searchSemanticMemoryVector(queryEmbedding, {
          limit: pool,
          types: opts?.types,
          status: opts?.status,
          sourceSessions: opts?.sourceSessions,
        })
      : Promise.resolve([]),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: semanticMemoryDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));
  const vectorRanked = vectorHits.map((h) => ({ ...h, docKey: h.docKey }));

  const merged = rrfMerge([ftsRanked, trgmRanked, vectorRanked], { limit: pool });
  return merged.slice(offset, offset + limit).map((row) => ({
    ...mapSemanticMemoryRow(row),
    rank: row.score,
  }));
}

export async function hybridSearchMessages(
  query: string,
  opts?: { sessionId?: string; limit?: number },
): Promise<MessageFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(50, opts?.limit ?? 10));
  const queryEmbedding = await embedQueryText(q);

  const ftsHits = await searchMessagesFtsRaw(q, { ...opts, limit: candidateLimit(limit, 0) });
  const pool = candidateLimit(limit, ftsHits.length);
  const [trgmHits, vectorHits] = await Promise.all([
    searchMessagesTrgm(q, { ...opts, limit: pool }),
    queryEmbedding
      ? searchMessagesVector(queryEmbedding, { ...opts, limit: pool })
      : Promise.resolve([]),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: messageDocKey(h.id) }));
  const merged = rrfMerge([ftsRanked, trgmHits, vectorHits], { limit: pool });

  return merged.slice(0, limit).map((row) => ({
    message_id: row.id,
    content: row.content,
    role: row.role,
    session_id: row.session_id,
    timestamp: row.timestamp,
    rank: row.score,
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
  const minSim = getFtsTrgmMinSimilarity(getActiveConfig().data);
  const queryEmbedding = await embedQueryText(q);

  const db = getDb();
  const typeFilter = pgSemanticTypeFilter(types);
  const statusFilter = status === "all" ? drizzleSql`` : drizzleSql`AND sm.status = ${status}`;
  const sourceFilter = pgSemanticSourceSessionsFilter(sourceSessions);

  const vectorUnion =
    queryEmbedding && queryEmbedding.length > 0
      ? drizzleSql`
      UNION
      SELECT sm.id
      FROM semantic_memory sm
      WHERE sm.content_embedding IS NOT NULL
      ${statusFilter}
      ${typeFilter}
      ${sourceFilter}
    `
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
      ${vectorUnion}
    ) merged
  `);
  return Number(rows[0]?.n ?? 0);
}
