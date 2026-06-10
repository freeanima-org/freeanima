import type { MemoryReferenceStorePort } from "@freeanima/engine-repos";

/** 从 memory_references 全量重算 semantic_memory.reference_count */
export async function syncSemanticMemoryReferenceCounts(
  store: MemoryReferenceStorePort,
): Promise<{ updated: number }> {
  return store.syncAllReferenceCounts();
}
