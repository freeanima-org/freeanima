import type { MemoryReferenceStorePort } from "@freeanima/core/repos";

/** Recompute semantic_memory.reference_count from memory_references in full */
export async function syncSemanticMemoryReferenceCounts(
  store: MemoryReferenceStorePort,
): Promise<{ updated: number }> {
  return store.syncAllReferenceCounts();
}
