import type { SemanticFtsHit } from "@freeanima/core/db/schema/rows";
import { validateFtsQueryInput } from "@freeanima/core/util";
import { searchSemanticMemoryFts } from "@freeanima/core/db/pg/semantic-memory";

import type { SemanticRecallHit } from "../recall-search.ts";
import {
  effectivePassiveRecallMinScore,
  hybridRankToScore,
  meetsPassiveRecallMinScore,
} from "./score.ts";

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

/** Semantic-only hybrid search for passive recall (no cross-type RRF). */
export async function semanticPassiveRecallSearch(
  query: string,
  opts?: { limit?: number; min_score?: number; min_relative_score?: number },
): Promise<SemanticRecallHit[]> {
  const q = query.trim();
  if (!q) return [];

  validateFtsQueryInput(q);

  const limit = Math.max(1, Math.min(20, opts?.limit ?? 5));
  const pool = Math.max(limit * 4, 20);

  const rows = await searchSemanticMemoryFts(q, { limit: pool });
  if (rows.length === 0) return [];

  const effectiveMin = effectivePassiveRecallMinScore(rows, opts);
  const hits: SemanticRecallHit[] = [];
  for (const row of rows) {
    const score = hybridRankToScore(row.rank);
    if (!meetsPassiveRecallMinScore(score, effectiveMin)) continue;
    hits.push(mapSemanticRow(row, score));
    if (hits.length >= limit) break;
  }
  return hits;
}

export { effectivePassiveRecallMinScore } from "./score.ts";
