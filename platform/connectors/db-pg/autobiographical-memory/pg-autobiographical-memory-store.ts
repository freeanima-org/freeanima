import type { AutobiographicalMemoryStorePort } from "@freeanima/core/repos";

import * as crudRepo from "./repos/autobiographical-crud-repo.ts";
import * as ftsRepo from "./repos/autobiographical-fts-repo.ts";

/** PostgreSQL AutobiographicalMemoryStorePort implementation */
export const pgAutobiographicalMemoryStore: AutobiographicalMemoryStorePort = {
  create: crudRepo.createAutobiographicalMemory,
  get: crudRepo.getAutobiographicalMemory,
  deprecate: crudRepo.deprecateAutobiographicalMemory,
  count: crudRepo.countAutobiographicalMemory,
  listActive: crudRepo.listActiveAutobiographicalMemory,
  listCreatedSince: crudRepo.listAutobiographicalMemoryCreatedSince,
  listBySourceSemanticMemory: crudRepo.listAutobiographicalMemoryBySourceSemanticMemory,
  listBySourceConversations: crudRepo.listAutobiographicalMemoryBySourceSessions,
  list: crudRepo.listAutobiographicalMemory,
  searchFts: ftsRepo.searchAutobiographicalMemoryFts,
};
