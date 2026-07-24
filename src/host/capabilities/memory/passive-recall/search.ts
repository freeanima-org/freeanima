import type { SemanticFtsHit } from "@freeanima/host/core/db/schema/rows";
import {
  DEFAULT_PASSIVE_RECALL_MIN_RELATIVE_SCORE,
  DEFAULT_PASSIVE_RECALL_MIN_SCORE,
  getActiveRuntimeConfig,
  getFtsTrgmFallbackWhenHitsLt,
} from "@freeanima/host/core/config";
import { buildFtsTsQuery } from "@freeanima/host/core/db/pg/fts/query.ts";
import { searchSemanticMemoryFtsRaw } from "@freeanima/host/core/db/pg/fts/hybrid-raw.ts";
import { searchSemanticMemoryTrgm } from "@freeanima/host/core/db/pg/fts/trgm-search.ts";
import { searchSemanticMemoryFts } from "@freeanima/host/core/db/pg/semantic-memory";
import {
  omitUndefined,
  rrfMerge,
  semanticMemoryDocKey,
  validateFtsQueryInput,
} from "@freeanima/host/core/util";

import type { SemanticRecallHit } from "../recall-search.ts";
import {
  previewPassiveContent,
  type PassiveRecallDebugHit,
  type PassiveRecallDebugTrace,
} from "./debug-types.ts";
import {
  effectivePassiveRecallMinScore,
  hybridRankToScore,
  meetsPassiveRecallMinScore,
} from "./score.ts";

export type { PassiveRecallDebugHit, PassiveRecallDebugTrace } from "./debug-types.ts";

function mapSemanticRow(row: SemanticFtsHit, score: number): SemanticRecallHit {
  return {
    memory_type: "semantic",
    score,
    semantic_memory_id: row.id,
    type: row.type,
    pinned: row.pinned,
    content: row.content,
    source_conversations: row.source_conversations,
    observed_at: row.observed_at?.toISOString() ?? null,
    occurred_at: row.occurred_at,
    status: row.status,
  };
}

function toDebugHit(id: number, score: number, content: string): PassiveRecallDebugHit {
  return { id, score, content_preview: previewPassiveContent(content) };
}

function candidatePool(requested: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveRuntimeConfig().data);
  const base = Math.max(requested * 3, 20);
  if (fallback > 0) return Math.max(base, requested * 5);
  return base;
}

export type SemanticPassiveRecallSearchResult = {
  hits: SemanticRecallHit[];
  debug?: PassiveRecallDebugTrace;
};

/** Semantic-only hybrid search for passive recall (no cross-type RRF). */
export async function semanticPassiveRecallSearch(
  query: string,
  opts?: {
    limit?: number;
    min_score?: number;
    min_relative_score?: number;
    /** Collect FTS / trgm / merge / filter stages for LLM debug */
    debug?: boolean;
  },
): Promise<SemanticRecallHit[]> {
  const result = await semanticPassiveRecallSearchDetailed(query, opts);
  return result.hits;
}

/** Same as semanticPassiveRecallSearch, optionally with channel/debug trace. */
export async function semanticPassiveRecallSearchDetailed(
  query: string,
  opts?: {
    limit?: number;
    min_score?: number;
    min_relative_score?: number;
    debug?: boolean;
  },
): Promise<SemanticPassiveRecallSearchResult> {
  const q = query.trim();
  if (!q) return { hits: [] };

  validateFtsQueryInput(q);

  const limit = Math.max(1, Math.min(20, opts?.limit ?? 5));
  const pool = Math.max(limit * 4, 20);
  const wantDebug = opts?.debug === true;
  const started = performance.now();
  const minScore = opts?.min_score ?? DEFAULT_PASSIVE_RECALL_MIN_SCORE;
  const minRelative = opts?.min_relative_score ?? DEFAULT_PASSIVE_RECALL_MIN_RELATIVE_SCORE;

  if (!wantDebug) {
    const rows = await searchSemanticMemoryFts(q, { limit: pool });
    if (rows.length === 0) return { hits: [] };
    const effectiveMin = effectivePassiveRecallMinScore(rows, opts);
    const hits: SemanticRecallHit[] = [];
    for (const row of rows) {
      const score = hybridRankToScore(row.rank);
      if (!meetsPassiveRecallMinScore(score, effectiveMin)) continue;
      hits.push(mapSemanticRow(row, score));
      if (hits.length >= limit) break;
    }
    return { hits };
  }

  const fetchPool = candidatePool(pool);
  const [tsquery, ftsHits, trgmHits] = await Promise.all([
    buildFtsTsQuery(q).catch(() => ""),
    searchSemanticMemoryFtsRaw(q, { limit: fetchPool, status: "active" }),
    searchSemanticMemoryTrgm(q, { limit: fetchPool, status: "active" }),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: semanticMemoryDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));
  const merged = rrfMerge([ftsRanked, trgmRanked], { limit: pool }).map(
    ({ docKey: _docKey, score, rank: _rank, ...row }) => ({
      ...row,
      rank: score,
    }),
  );

  const effectiveMin = effectivePassiveRecallMinScore(merged, opts);
  const afterScore: SemanticRecallHit[] = [];
  for (const row of merged) {
    const score = hybridRankToScore(row.rank);
    if (!meetsPassiveRecallMinScore(score, effectiveMin)) continue;
    afterScore.push(mapSemanticRow(row, score));
    if (afterScore.length >= limit) break;
  }

  const debug: PassiveRecallDebugTrace = {
    query: q,
    tsquery: tsquery || null,
    effective_min_score: effectiveMin,
    min_score: minScore,
    min_relative_score: minRelative,
    fts: ftsHits.map((h) => toDebugHit(h.id, h.rank, h.content)),
    trgm: trgmHits.map((h) => toDebugHit(h.id, h.rank, h.content)),
    merged: merged.map((h) => toDebugHit(h.id, hybridRankToScore(h.rank), h.content)),
    after_score_filter: afterScore.map((h) => toDebugHit(h.semantic_memory_id, h.score, h.content)),
    after_resident_filter: afterScore.map((h) =>
      toDebugHit(h.semantic_memory_id, h.score, h.content),
    ),
    excluded_resident_ids: [],
    injected: [],
    elapsed_ms: Math.round(performance.now() - started),
  };

  return omitUndefined({ hits: afterScore, debug });
}

export { effectivePassiveRecallMinScore } from "./score.ts";
