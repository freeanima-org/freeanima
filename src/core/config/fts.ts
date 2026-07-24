import type { AnimaConfig } from "./schemas/config.ts";

const DEFAULT_TRGM_MIN_SIMILARITY = 0.3;
const DEFAULT_TRGM_FALLBACK_WHEN_HITS_LT = 3;

export function getFtsTrgmMinSimilarity(cfg: AnimaConfig): number {
  const raw = cfg.fts?.trgm?.min_similarity;
  return typeof raw === "number" && raw >= 0 && raw <= 1 ? raw : DEFAULT_TRGM_MIN_SIMILARITY;
}

/** FTS 命中数低于此值时扩大 trgm 候选池；0 表示 hybrid messages 始终并行 FTS+trgm */
export function getFtsTrgmFallbackWhenHitsLt(cfg: AnimaConfig): number {
  const raw = cfg.fts?.trgm?.fallback_when_hits_lt;
  return typeof raw === "number" && raw >= 0 ? raw : DEFAULT_TRGM_FALLBACK_WHEN_HITS_LT;
}
