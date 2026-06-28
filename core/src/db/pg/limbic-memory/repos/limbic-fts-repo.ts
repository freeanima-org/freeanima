import type { LimbicFtsHit } from "../types.ts";

import { hybridSearchLimbicMemory } from "../../fts/hybrid-search-limbic.ts";

export async function searchLimbicMemoryFts(
  query: string,
  opts?: { limit?: number },
): Promise<LimbicFtsHit[]> {
  return hybridSearchLimbicMemory(query, opts);
}
