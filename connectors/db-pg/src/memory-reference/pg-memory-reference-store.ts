import type { MemoryReferenceStorePort } from "@freeanima/engine-repos";

import * as repo from "./repos/memory-reference-repo.ts";

/** PostgreSQL MemoryReferenceStorePort 实现 */
export class PgMemoryReferenceStore implements MemoryReferenceStorePort {
  async recordFromMessage(input: Parameters<MemoryReferenceStorePort["recordFromMessage"]>[0]) {
    return repo.recordMessageReferences(input);
  }

  async syncAllReferenceCounts() {
    return repo.syncAllReferenceCounts();
  }

  async countBySemanticMemory(semanticMemoryId: string) {
    return repo.countReferencesBySemanticMemory(semanticMemoryId);
  }
}
