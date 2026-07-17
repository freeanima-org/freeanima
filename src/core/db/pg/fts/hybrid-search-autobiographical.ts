import type {
  AutobiographicalFtsHit,
  AutobiographicalStatus,
} from "@freeanima/core/db/pg/autobiographical-memory/types";
import { getActiveRuntimeConfig, getFtsTrgmFallbackWhenHitsLt } from "@freeanima/core/config";
import { autobiographicalDocKey, rrfMerge } from "@freeanima/core/util";

import {
  searchAutobiographicalMemoryFtsRaw,
  searchAutobiographicalMemoryTrgm,
} from "./autobiographical-search-raw.ts";

function candidateLimit(requested: number, ftsCount: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveRuntimeConfig().data);
  const base = Math.max(requested * 3, 20);
  if (fallback > 0 && ftsCount < fallback) {
    return Math.max(base, requested * 5);
  }
  return base;
}

export async function hybridSearchAutobiographicalMemory(
  query: string,
  opts?: { limit?: number; status?: AutobiographicalStatus },
): Promise<AutobiographicalFtsHit[]> {
  const q = query.trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
  const status = opts?.status ?? "active";

  const pool = candidateLimit(limit, 0);
  const [ftsHits, trgmHits] = await Promise.all([
    searchAutobiographicalMemoryFtsRaw(q, {
      limit: pool,
      status,
    }),
    searchAutobiographicalMemoryTrgm(q, { limit: pool, status }),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: autobiographicalDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));

  const merged = rrfMerge([ftsRanked, trgmRanked], { limit: pool });
  return merged.slice(0, limit).map((row) => ({
    ...row,
    rank: row.score,
  }));
}
