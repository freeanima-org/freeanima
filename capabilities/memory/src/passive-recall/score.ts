import type { SemanticFtsHit } from "@freeanima/core/repos";
import {
  DEFAULT_PASSIVE_RECALL_MIN_RELATIVE_SCORE,
  DEFAULT_PASSIVE_RECALL_MIN_SCORE,
} from "@freeanima/core/config";

export function hybridRankToScore(rank: number): number {
  return Math.max(0, rank);
}

export function meetsPassiveRecallMinScore(score: number, effectiveMin: number): boolean {
  return score + 1e-9 >= effectiveMin;
}

export function effectivePassiveRecallMinScore(
  rows: SemanticFtsHit[],
  opts?: { min_score?: number; min_relative_score?: number },
): number {
  const absoluteMin = opts?.min_score ?? DEFAULT_PASSIVE_RECALL_MIN_SCORE;
  const relativeRatio = opts?.min_relative_score ?? DEFAULT_PASSIVE_RECALL_MIN_RELATIVE_SCORE;
  if (rows.length === 0 || relativeRatio <= 0) return absoluteMin;

  const topRow = rows.at(0);
  if (topRow === undefined) return absoluteMin;

  const topScore = hybridRankToScore(topRow.rank);
  const relativeMin = topScore * relativeRatio;
  return Math.max(absoluteMin, relativeMin);
}
