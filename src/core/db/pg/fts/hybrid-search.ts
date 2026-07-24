import type { MessageFtsHit } from "@freeanima/core/db/pg/conversation/types";
import type { SemanticFtsHit } from "@freeanima/core/db/schema/rows";
import {
  getActiveRuntimeConfig,
  getFtsTrgmFallbackWhenHitsLt,
  getFtsTrgmMinSimilarity,
} from "@freeanima/core/config";
import { and, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import { entities } from "@freeanima/core/db/schema";
import { omitUndefined, rrfMerge, messageDocKey, semanticMemoryDocKey } from "@freeanima/core/util";

import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import { buildFtsTsQuery } from "./query.ts";
import { searchMessagesTrgm, searchSemanticMemoryTrgm } from "./trgm-search.ts";
import { searchSemanticMemoryFtsRaw, searchMessagesFtsRaw } from "./hybrid-raw.ts";

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

  const filterOpts = omitUndefined({
    types: opts?.types,
    status: opts?.status,
    source_conversations: opts?.source_conversations,
  });

  const pool = candidateLimit(fetchLimit, 0);
  const [ftsHits, trgmHits] = await Promise.all([
    searchSemanticMemoryFtsRaw(q, {
      ...filterOpts,
      limit: pool,
    }),
    searchSemanticMemoryTrgm(q, {
      ...filterOpts,
      limit: pool,
    }),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: semanticMemoryDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));

  const merged = rrfMerge([ftsRanked, trgmRanked], { limit: pool });
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
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveRuntimeConfig().data);

  let ftsHits: Awaited<ReturnType<typeof searchMessagesFtsRaw>>;
  let trgmHits: Awaited<ReturnType<typeof searchMessagesTrgm>>;
  let mergePool: number;

  // fallback=0：始终并行；否则先 FTS，再按真实命中数决定 trgm 候选池
  if (fallback === 0) {
    mergePool = candidateLimit(limit, 0);
    [ftsHits, trgmHits] = await Promise.all([
      searchMessagesFtsRaw(q, { ...opts, limit: mergePool }),
      searchMessagesTrgm(q, { ...opts, limit: mergePool }),
    ]);
  } else {
    const ftsPool = Math.max(limit * 3, 20);
    ftsHits = await searchMessagesFtsRaw(q, { ...opts, limit: ftsPool });
    mergePool = candidateLimit(limit, ftsHits.length);
    trgmHits = await searchMessagesTrgm(q, { ...opts, limit: mergePool });
  }

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: messageDocKey(h.id) }));
  const merged = rrfMerge([ftsRanked, trgmHits], { limit: Math.max(mergePool, ftsHits.length) });

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

  const db = getDb();
  const semanticConditions = buildSemanticConditions({ types, status, source_conversations });

  const tsqueryExpr = sql`to_tsquery('simple', ${tsquery})`;
  const ftsBranch = db
    .select({ id: entities.id })
    .from(entities)
    .where(
      and(
        sql`${entities.search_fts} @@ ${tsqueryExpr}`,
        ...(semanticConditions.length > 0 ? semanticConditions : []),
      ),
    );
  const trgmBranch = db
    .select({ id: entities.id })
    .from(entities)
    .where(
      and(
        sql`word_similarity(${entities.content}, ${q}) >= ${minSim}`,
        ...(semanticConditions.length > 0 ? semanticConditions : []),
      ),
    );

  const merged = union(ftsBranch, trgmBranch).as("merged");
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(merged);
  return Number(rows[0]?.n ?? 0);
}
