import { loadConfig } from "./config.ts";

const DEFAULT_TRGM_MIN_SIMILARITY = 0.25;
const DEFAULT_TRGM_FALLBACK_WHEN_HITS_LT = 3;

/** pg_trgm similarity 下限 */
export function getFtsTrgmMinSimilarity(): number {
  const raw = loadConfig().fts?.trgm?.min_similarity;
  return typeof raw === "number" && raw >= 0 && raw <= 1 ? raw : DEFAULT_TRGM_MIN_SIMILARITY;
}

/** FTS 命中低于此值时 trgm 路取更大候选集；0 表示始终并行 */
export function getFtsTrgmFallbackWhenHitsLt(): number {
  const raw = loadConfig().fts?.trgm?.fallback_when_hits_lt;
  return typeof raw === "number" && raw >= 0 ? raw : DEFAULT_TRGM_FALLBACK_WHEN_HITS_LT;
}
