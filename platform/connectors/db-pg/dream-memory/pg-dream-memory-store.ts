import type { DreamMemoryStorePort } from "@freeanima/core/repos";

import * as crudRepo from "./repos/dream-crud-repo.ts";

/** PostgreSQL DreamMemoryStorePort implementation */
export const pgDreamMemoryStore: DreamMemoryStorePort = {
  create: crudRepo.createDreamMemory,
  getByDay: crudRepo.getDreamMemoryByDay,
  getLatest: crudRepo.getLatestDreamMemory,
  list: crudRepo.listDreamMemory,
  count: crudRepo.countDreamMemory,
};
