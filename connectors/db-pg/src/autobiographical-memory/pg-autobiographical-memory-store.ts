import type { AutobiographicalMemoryStorePort } from "@freeanima/storage-repos";

import * as crudRepo from "./repos/autobiographical-crud-repo.ts";

/** PostgreSQL AutobiographicalMemoryStorePort implementation */
export const pgAutobiographicalMemoryStore: AutobiographicalMemoryStorePort = {
  create: crudRepo.createAutobiographicalMemory,
  get: crudRepo.getAutobiographicalMemory,
  deprecate: crudRepo.deprecateAutobiographicalMemory,
  count: crudRepo.countAutobiographicalMemory,
  listActive: crudRepo.listActiveAutobiographicalMemory,
  listCreatedSince: crudRepo.listAutobiographicalMemoryCreatedSince,
  listBySourceSemanticMemory: crudRepo.listAutobiographicalMemoryBySourceSemanticMemory,
  listBySourceSessions: crudRepo.listAutobiographicalMemoryBySourceSessions,
  list: crudRepo.listAutobiographicalMemory,
};
