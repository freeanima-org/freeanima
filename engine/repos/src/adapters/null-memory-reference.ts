import type { MemoryReferenceStorePort } from "../ports/memory-reference.ts";

/** PG 不可用时的记忆引用端口空实现 */
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
