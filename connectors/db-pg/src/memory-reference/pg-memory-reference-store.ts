import type { MemoryReferenceStorePort } from "@freeanima/storage-repos";

import * as repo from "./repos/memory-reference-repo.ts";

/** PostgreSQL MemoryReferenceStorePort implementation */
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
