import type { SemanticMemoryStorePort } from "@freeanima/core/repos";

import * as crudRepo from "./repos/semantic-crud-repo.ts";
import * as ftsRepo from "./repos/semantic-fts-repo.ts";
import * as searchRepo from "./repos/semantic-search-repo.ts";

/** PostgreSQL SemanticMemoryStorePort implementation */
export const pgSemanticMemoryStore: SemanticMemoryStorePort = {
  create: crudRepo.createSemanticMemory,
  get: crudRepo.getSemanticMemory,
  update: crudRepo.updateSemanticMemory,
  deprecate: crudRepo.deprecateSemanticMemory,
  delete: crudRepo.deleteSemanticMemory,
  count: crudRepo.countSemanticMemory,
  listResident: crudRepo.listResidentSemanticMemory,
  listAll: crudRepo.listAllSemanticMemory,
  listActive: crudRepo.listActiveSemanticMemory,
  listBySourceSessions: crudRepo.listSemanticMemoryBySourceSessions,
  searchFts: ftsRepo.searchSemanticMemoryFts,
  search: searchRepo.searchSemanticMemory,
  countSearch: searchRepo.countSemanticMemorySearch,
  findByContent: crudRepo.findSemanticMemoryByContent,
};
