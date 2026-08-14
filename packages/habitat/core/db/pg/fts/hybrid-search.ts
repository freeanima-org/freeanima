import type { MessageFtsHit } from "@freeanima/habitat/core/db/pg/conversation/types";
import type { SemanticFtsHit } from "@freeanima/habitat/core/db/schema/rows";
import {
  getActiveRuntimeConfig,
  getFtsTrgmFallbackWhenHitsLt,
  getFtsTrgmMinSimilarity,
} from "@freeanima/habitat/core/config";
import { and, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import { entities } from "@freeanima/habitat/core/db/schema";
import {
  omitUndefined,
  rrfMerge,
  messageDocKey,
  semanticMemoryDocKey,
} from "@freeanima/habitat/core/util";

import { getDb } from "../client.ts";
import { buildSemanticConditions } from "../semantic-memory/repos/semantic-filters.ts";
import { entitySearchDocumentsJoin } from "../search/pg-search-index/channel-fts.ts";
import { searchDocuments } from "@freeanima/habitat/core/db/schema";
import { extractContentWords } from "./content-words.ts";
import { buildFtsTsQuery } from "./query.ts";
import { searchMessagesTrgm, searchSemanticMemoryTrgm } from "./trgm-search.ts";
import { searchSemanticMemoryFtsRaw, searchMessagesFtsRaw } from "./hybrid-raw.ts";
import { searchSemanticMemoryVector } from "./vector-search.ts";

function candidateLimit(requested: number, ftsCount: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveRuntimeConfig().data);
  const base = Math.max(requested * 3, 20);
  if (fallback > 0 && ftsCount < fallback) {
    return Math.max(base, requested * 5);
  }
  return base;
}

/** Drop hits that only appeared on the vector channel (keyword-first). */
export function dropVectorOnlyHits<T extends { docKey: string }>(
  merged: T[],
  lexicalLists: Array<Array<{ docKey: string }>>,
): T[] {
  const lexicalKeys = new Set<string>();
  for (const list of lexicalLists) {
    for (const hit of list) lexicalKeys.add(hit.docKey);
  }
  return merged.filter((h) => lexicalKeys.has(h.docKey));
}

export async function hybridSearchSemanticMemory(
  query: string,
  opts?: {
    limit?: number;
    types?: string[];
    status?: "active" | "deprecated" | "all";
    offset?: number;
    source_conversations?: string[];
    /**
     * When true, run vector channel on the **full** query sentence and RRF-merge,
     * then drop vector-only hits (boost lexical matches only).
     */
    use_vector?: boolean;
  },
): Promise<SemanticFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const offset = Math.max(0, opts?.offset ?? 0);
  const fetchLimit = limit + offset;
  const useVector = opts?.use_vector === true;

  const filterOpts = omitUndefined({
    types: opts?.types,
    status: opts?.status,
    source_conversations: opts?.source_conversations,
  });

  const content = await extractContentWords(q);
  const lexicalQuery = content.query;

  const pool = candidateLimit(fetchLimit, 0);
  const [ftsHits, trgmHits, vectorHits] = await Promise.all([
    searchSemanticMemoryFtsRaw(lexicalQuery, {
      ...filterOpts,
      limit: pool,
    }),
    searchSemanticMemoryTrgm(lexicalQuery, {
      ...filterOpts,
      limit: pool,
    }),
    useVector
      ? searchSemanticMemoryVector(q, {
          ...filterOpts,
          limit: pool,
        })
      : Promise.resolve([]),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: semanticMemoryDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));
  const vectorRanked = vectorHits.map((h) => ({ ...h, docKey: h.docKey }));

  const rankedLists = useVector ? [ftsRanked, trgmRanked, vectorRanked] : [ftsRanked, trgmRanked];
  let merged = rrfMerge(rankedLists, { limit: pool });
  if (useVector) {
    merged = dropVectorOnlyHits(merged, [ftsRanked, trgmRanked]);
  }

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

  const content = await extractContentWords(q);
  const lexicalQuery = content.query;
  const tsquery = await buildFtsTsQuery(lexicalQuery);
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
    .innerJoin(searchDocuments, entitySearchDocumentsJoin())
    .where(
      and(
        sql`${searchDocuments.search_fts} @@ ${tsqueryExpr}`,
        ...(semanticConditions.length > 0 ? semanticConditions : []),
      ),
    );
  const trgmBranch = db
    .select({ id: entities.id })
    .from(entities)
    .where(
      and(
        sql`word_similarity(${entities.content}, ${lexicalQuery}) >= ${minSim}`,
        ...(semanticConditions.length > 0 ? semanticConditions : []),
      ),
    );

  const merged = union(ftsBranch, trgmBranch).as("merged");
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(merged);
  return rows[0]?.n ?? 0;
}
