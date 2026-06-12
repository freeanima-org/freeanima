import type { AnimaConfig } from "@freeanima/storage-config";

const DEFAULT_TRGM_MIN_SIMILARITY = 0.3;
const DEFAULT_TRGM_FALLBACK_WHEN_HITS_LT = 3;

export function getFtsTrgmMinSimilarity(cfg: AnimaConfig): number {
  const raw = cfg.fts?.trgm?.min_similarity;
  return typeof raw === "number" && raw >= 0 && raw <= 1 ? raw : DEFAULT_TRGM_MIN_SIMILARITY;
}

/** When FTS score below this, trgm path uses larger candidate set; 0 means always parallel */
export function getFtsTrgmFallbackWhenHitsLt(cfg: AnimaConfig): number {
  const raw = cfg.fts?.trgm?.fallback_when_hits_lt;
  return typeof raw === "number" && raw >= 0 ? raw : DEFAULT_TRGM_FALLBACK_WHEN_HITS_LT;
}
