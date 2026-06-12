import type { MemoryReferenceStorePort } from "@freeanima/storage-repos";

import * as repo from "./repos/memory-reference-repo.ts";

/** PostgreSQL MemoryReferenceStorePort implementation */
export const pgMemoryReferenceStore: MemoryReferenceStorePort = {
  recordFromMessage: repo.recordMessageReferences,
  syncAllReferenceCounts: repo.syncAllReferenceCounts,
  countBySemanticMemory: repo.countReferencesBySemanticMemory,
};
