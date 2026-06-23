import type { LimbicMemoryStorePort } from "@freeanima/core/repos";

import * as crudRepo from "./repos/limbic-crud-repo.ts";
import * as ftsRepo from "./repos/limbic-fts-repo.ts";
import * as listRepo from "./repos/limbic-list-repo.ts";
import * as bySessionsRepo from "./repos/limbic-by-sessions-repo.ts";

/** PostgreSQL LimbicMemoryStorePort implementation */
export const pgLimbicMemoryStore: LimbicMemoryStorePort = {
  create: crudRepo.createLimbicMemory,
  get: crudRepo.getLimbicMemory,
  listBySession: crudRepo.listLimbicMemoryBySession,
  listBySessions: bySessionsRepo.listLimbicMemoryBySessions,
  list: listRepo.listLimbicMemory,
  count: listRepo.countLimbicMemory,
  searchFts: ftsRepo.searchLimbicMemoryFts,
};
