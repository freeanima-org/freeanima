import type { SemanticFtsHit } from "@freeanima/core/repos";
import { validateFtsQueryInput } from "@freeanima/core/util";
import { searchSemanticMemoryFts } from "@freeanima/core/db/pg/semantic-memory";

import type { SemanticRecallHit } from "../recall-search.ts";

function hybridRankToScore(rank: number): number {
  return Math.max(0, rank);
}

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
  opts?: { limit?: number; min_score?: number },
): Promise<SemanticRecallHit[]> {
  const q = query.trim();
  if (!q) return [];

  validateFtsQueryInput(q);

  const limit = Math.max(1, Math.min(20, opts?.limit ?? 5));
  const minScore = opts?.min_score ?? 0;
  const pool = Math.max(limit * 3, 15);

  const rows = await searchSemanticMemoryFts(q, { limit: pool });
  const hits: SemanticRecallHit[] = [];
  for (const row of rows) {
    const score = hybridRankToScore(row.rank);
    if (score < minScore) continue;
    hits.push(mapSemanticRow(row, score));
    if (hits.length >= limit) break;
  }
  return hits;
}
