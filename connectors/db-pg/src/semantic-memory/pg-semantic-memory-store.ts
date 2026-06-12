import type { SemanticMemoryStorePort } from "@freeanima/storage-repos";

import * as crudRepo from "./repos/semantic-crud-repo.ts";
import * as ftsRepo from "./repos/semantic-fts-repo.ts";
import * as searchRepo from "./repos/semantic-search-repo.ts";

/** PostgreSQL SemanticMemoryStorePort implementation */
export class PgSemanticMemoryStore implements SemanticMemoryStorePort {
  async create(row: Parameters<SemanticMemoryStorePort["create"]>[0]) {
    return crudRepo.createSemanticMemory(row);
  }

  async get(id: string) {
    return crudRepo.getSemanticMemory(id);
  }

  async update(row: Parameters<SemanticMemoryStorePort["update"]>[0]) {
    return crudRepo.updateSemanticMemory(row);
  }

  async deprecate(id: string) {
    return crudRepo.deprecateSemanticMemory(id);
  }

  async delete(id: string) {
    return crudRepo.deleteSemanticMemory(id);
  }

  async count() {
    return crudRepo.countSemanticMemory();
  }

  async listResident(topN?: number) {
    return crudRepo.listResidentSemanticMemory(topN);
  }

  async listAll() {
    return crudRepo.listAllSemanticMemory();
  }

  async listBySourceSessions(
    sessionIds: string[],
    opts?: { status?: "active" | "deprecated" | "all" },
  ) {
    return crudRepo.listSemanticMemoryBySourceSessions(sessionIds, opts);
  }

  async searchFts(query: string, opts?: { limit?: number; types?: string[] }) {
    return ftsRepo.searchSemanticMemoryFts(query, opts);
  }

  async search(opts: Parameters<SemanticMemoryStorePort["search"]>[0]) {
    return searchRepo.searchSemanticMemory(opts);
  }

  async countSearch(opts: Parameters<SemanticMemoryStorePort["countSearch"]>[0]) {
    return searchRepo.countSemanticMemorySearch(opts);
  }

  async findByContent(content: string) {
    return crudRepo.findSemanticMemoryByContent(content);
  }
}
