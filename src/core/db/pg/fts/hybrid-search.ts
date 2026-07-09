import type { MessageFtsHit, SemanticFtsHit } from "@freeanima/core/repos";
import {
  getActiveRuntimeConfig,
  getFtsTrgmFallbackWhenHitsLt,
  getFtsTrgmMinSimilarity,
} from "@freeanima/core/config";
import { and, isNotNull, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import { semanticMemory } from "@freeanima/core/db/schema";
import { omitUndefined, rrfMerge, messageDocKey, semanticMemoryDocKey } from "@freeanima/core/util";

import { embedQueryText } from "../embedding/query.ts";
import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import { buildFtsTsQuery } from "./query.ts";
import { searchMessagesTrgm, searchSemanticMemoryTrgm } from "./trgm-search.ts";
import { searchSemanticMemoryFtsRaw, searchMessagesFtsRaw } from "./hybrid-raw.ts";
import { searchMessagesVector, searchSemanticMemoryVector } from "./vector-search.ts";

function candidateLimit(requested: number, ftsCount: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveRuntimeConfig().data);
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
    source_conversations?: string[];
  },
): Promise<SemanticFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const offset = Math.max(0, opts?.offset ?? 0);
  const fetchLimit = limit + offset;

  const queryEmbedding = await embedQueryText(q);

  const filterOpts = omitUndefined({
    types: opts?.types,
    status: opts?.status,
    source_conversations: opts?.source_conversations,
  });

  const ftsHits = await searchSemanticMemoryFtsRaw(q, {
    ...filterOpts,
    limit: candidateLimit(fetchLimit, 0),
  });
  const pool = candidateLimit(fetchLimit, ftsHits.length);
  const [trgmHits, vectorHits] = await Promise.all([
    searchSemanticMemoryTrgm(q, {
      ...filterOpts,
      limit: pool,
    }),
    queryEmbedding
      ? searchSemanticMemoryVector(queryEmbedding, {
          ...filterOpts,
          limit: pool,
        })
      : Promise.resolve([]),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: semanticMemoryDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));
  const vectorRanked = vectorHits.map((h) => ({ ...h, docKey: h.docKey }));

  const merged = rrfMerge([ftsRanked, trgmRanked, vectorRanked], { limit: pool });
  return merged.slice(offset, offset + limit).map(({ docKey, score, rank: _ftsRank, ...row }) => ({
    ...row,
    rank: score,
  }));
}

export async function hybridSearchMessages(
  query: string,
  opts?: { conversation_id?: string; limit?: number },
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
    conversation_id: row.conversation_id,
    timestamp: row.timestamp,
    rank: row.score,
  }));
}

export async function hybridCountSemanticMemory(
  query: string,
  opts?: {
    types?: string[];
    status?: "active" | "deprecated" | "all";
    source_conversations?: string[];
  },
): Promise<number> {
  const q = query.trim();
  if (!q) return 0;

  const tsquery = await buildFtsTsQuery(q);
  if (!tsquery) return 0;

  const types = opts?.types?.filter(Boolean) ?? [];
  const status = opts?.status ?? "active";
  const source_conversations =
    opts?.source_conversations?.map((s) => s.trim()).filter(Boolean) ?? [];
  const minSim = getFtsTrgmMinSimilarity(getActiveRuntimeConfig().data);
  const queryEmbedding = await embedQueryText(q);

  const db = getDb();
  const semanticConditions = buildSemanticConditions({ types, status, source_conversations });
  const whereSemantic = semanticConditions.length > 0 ? and(...semanticConditions) : undefined;

  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const ftsBranch = db
    .select({ id: semanticMemory.id })
    .from(semanticMemory)
    .where(
      and(
        sql`${semanticMemory.content_fts} @@ ${tsqueryExpr}`,
        ...(semanticConditions.length > 0 ? semanticConditions : []),
      ),
    );
  const trgmBranch = db
    .select({ id: semanticMemory.id })
    .from(semanticMemory)
    .where(
      and(
        sql`word_similarity(${semanticMemory.content}, ${q}) >= ${minSim}`,
        ...(semanticConditions.length > 0 ? semanticConditions : []),
      ),
    );

  const vectorBranch = db
    .select({ id: semanticMemory.id })
    .from(semanticMemory)
    .where(and(isNotNull(semanticMemory.content_embedding), whereSemantic));

  const merged =
    queryEmbedding && queryEmbedding.length > 0
      ? union(ftsBranch, trgmBranch, vectorBranch).as("merged")
      : union(ftsBranch, trgmBranch).as("merged");
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(merged);
  return Number(rows[0]?.n ?? 0);
}
