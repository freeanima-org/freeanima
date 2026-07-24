import { syncAllReferenceCounts } from "@freeanima/host/core/db/pg/memory-reference";

/** Recompute semantic_memory.reference_count from memory_references in full */
export async function syncSemanticMemoryReferenceCounts(): Promise<{ updated: number }> {
  const result = await syncAllReferenceCounts();
  return { updated: result.updated };
}
