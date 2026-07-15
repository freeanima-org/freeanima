import type { LimbicFtsHit } from "@freeanima/core/db/pg/limbic-memory/types";
import { getActiveRuntimeConfig, getFtsTrgmFallbackWhenHitsLt } from "@freeanima/core/config";
import { limbicDocKey, rrfMerge } from "@freeanima/core/util";

import { embedQueryText } from "../embedding/query.ts";
import {
  searchLimbicMemoryFtsRaw,
  searchLimbicMemoryTrgm,
  searchLimbicMemoryVector,
} from "./limbic-search-raw.ts";

function candidateLimit(requested: number, ftsCount: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveRuntimeConfig().data);
  const base = Math.max(requested * 3, 20);
  if (fallback > 0 && ftsCount < fallback) {
    return Math.max(base, requested * 5);
  }
  return base;
}

export async function hybridSearchLimbicMemory(
  query: string,
  opts?: { limit?: number },
): Promise<LimbicFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));

  const pool = candidateLimit(limit, 0);
  const vectorBranch = embedQueryText(q).then((queryEmbedding) =>
    queryEmbedding
      ? searchLimbicMemoryVector(queryEmbedding, { limit: pool })
      : Promise.resolve([]),
  );
  const [ftsHits, trgmHits, vectorHits] = await Promise.all([
    searchLimbicMemoryFtsRaw(q, { limit: pool }),
    searchLimbicMemoryTrgm(q, { limit: pool }),
    vectorBranch,
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: limbicDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));
  const vectorRanked = vectorHits.map((h) => ({ ...h, docKey: h.docKey }));

  const merged = rrfMerge([ftsRanked, trgmRanked, vectorRanked], { limit: pool });
  return merged.slice(0, limit).map((row) => ({
    ...row,
    rank: row.score,
  }));
}
