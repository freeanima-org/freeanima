import type { LimbicMemoryStorePort } from "@freeanima/storage-repos";

import * as crudRepo from "./repos/limbic-crud-repo.ts";
import * as listRepo from "./repos/limbic-list-repo.ts";

/** PostgreSQL LimbicMemoryStorePort implementation */
export const pgLimbicMemoryStore: LimbicMemoryStorePort = {
  create: crudRepo.createLimbicMemory,
  get: crudRepo.getLimbicMemory,
  listBySession: crudRepo.listLimbicMemoryBySession,
  list: listRepo.listLimbicMemory,
  count: listRepo.countLimbicMemory,
};
