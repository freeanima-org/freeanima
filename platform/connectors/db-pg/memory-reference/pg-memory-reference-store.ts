import type { MemoryReferenceStorePort } from "@freeanima/core/repos";

import * as repo from "./repos/memory-reference-repo.ts";

/** PostgreSQL MemoryReferenceStorePort implementation */
export const pgMemoryReferenceStore: MemoryReferenceStorePort = {
  recordFromMessage: repo.recordMessageReferences,
  syncAllReferenceCounts: repo.syncAllReferenceCounts,
  countBySemanticMemory: repo.countReferencesBySemanticMemory,
};
