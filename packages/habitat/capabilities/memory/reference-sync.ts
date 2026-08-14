import { syncAllReferenceCounts } from "@freeanima/habitat/core/db/pg/memory-reference";

/** Recompute entities.reference_count from message `[[anima:id]]` markers (no edge table) */
export async function syncSemanticMemoryReferenceCounts(): Promise<{ updated: number }> {
  const result = await syncAllReferenceCounts();
  return { updated: result.updated };
}
