import type { AutobiographicalFtsHit, AutobiographicalStatus } from "@freeanima/core/repos";

import { hybridSearchAutobiographicalMemory } from "../../fts/hybrid-search-autobiographical.ts";

export async function searchAutobiographicalMemoryFts(
  query: string,
  opts?: { limit?: number; status?: AutobiographicalStatus },
): Promise<AutobiographicalFtsHit[]> {
  return hybridSearchAutobiographicalMemory(query, opts);
}
