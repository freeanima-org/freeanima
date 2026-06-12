import type { SemanticFtsHit } from "@freeanima/core/repos";

import { hybridSearchSemanticMemory } from "../../fts/hybrid-search.ts";

export async function searchSemanticMemoryFts(
  query: string,
  opts?: { limit?: number; types?: string[] },
): Promise<SemanticFtsHit[]> {
  return hybridSearchSemanticMemory(query, {
    limit: opts?.limit,
    types: opts?.types,
    status: "active",
  });
}
