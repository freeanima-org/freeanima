import type { AutobiographicalFtsHit, AutobiographicalStatus } from "@freeanima/core/repos";
import { getActiveConfig, getFtsTrgmFallbackWhenHitsLt } from "@freeanima/platform/config";
import { autobiographicalDocKey, rrfMerge } from "@freeanima/core/util";

import { embedQueryText } from "../embedding/query.ts";
import { mapAutobiographicalMemoryRow } from "../autobiographical-memory/mappers/autobiographical-mapper.ts";
import {
  searchAutobiographicalMemoryFtsRaw,
  searchAutobiographicalMemoryTrgm,
  searchAutobiographicalMemoryVector,
} from "./autobiographical-search-raw.ts";

function candidateLimit(requested: number, ftsCount: number): number {
  const fallback = getFtsTrgmFallbackWhenHitsLt(getActiveConfig().data);
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
  const queryEmbedding = await embedQueryText(q);

  const ftsHits = await searchAutobiographicalMemoryFtsRaw(q, {
    limit: candidateLimit(limit, 0),
    status,
  });
  const pool = candidateLimit(limit, ftsHits.length);
  const [trgmHits, vectorHits] = await Promise.all([
    searchAutobiographicalMemoryTrgm(q, { limit: pool, status }),
    queryEmbedding
      ? searchAutobiographicalMemoryVector(queryEmbedding, { limit: pool, status })
      : Promise.resolve([]),
  ]);

  const ftsRanked = ftsHits.map((h) => ({ ...h, docKey: autobiographicalDocKey(h.id) }));
  const trgmRanked = trgmHits.map((h) => ({ ...h, docKey: h.docKey }));
  const vectorRanked = vectorHits.map((h) => ({ ...h, docKey: h.docKey }));

  const merged = rrfMerge([ftsRanked, trgmRanked, vectorRanked], { limit: pool });
  return merged.slice(0, limit).map((row) => ({
    ...mapAutobiographicalMemoryRow(row),
    rank: row.score,
  }));
}
