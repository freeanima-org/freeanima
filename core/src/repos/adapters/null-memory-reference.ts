import type { MemoryReferenceStorePort } from "../ports/memory-reference.ts";

/** Null memory-reference port when PG unavailable */
export const nullMemoryReferenceStore: MemoryReferenceStorePort = {
  async recordFromMessage() {
    return [];
  },
  async syncAllReferenceCounts() {
    return { updated: 0, rebuilt: 0 };
  },
  async countBySemanticMemory() {
    return 0;
  },
};
