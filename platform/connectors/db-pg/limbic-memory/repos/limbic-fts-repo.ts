import type { LimbicFtsHit } from "@freeanima/core/repos";

import { hybridSearchLimbicMemory } from "../../fts/hybrid-search-limbic.ts";

export async function searchLimbicMemoryFts(
  query: string,
  opts?: { limit?: number },
): Promise<LimbicFtsHit[]> {
  return hybridSearchLimbicMemory(query, opts);
}
