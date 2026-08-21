import type { SemanticFtsHit } from "@freeanima/habitat/core/db/schema/rows";
import { omitUndefined } from "@freeanima/habitat/core/util";

import { hybridSearchSemanticMemory } from "../../fts/hybrid-search.ts";

export async function searchSemanticMemoryFts(
  query: string,
  opts?: { limit?: number; types?: string[]; world_id?: number },
): Promise<SemanticFtsHit[]> {
  return hybridSearchSemanticMemory(query, {
    ...omitUndefined({
      limit: opts?.limit,
      types: opts?.types,
      world_id: opts?.world_id,
    }),
    status: "active",
  });
}
