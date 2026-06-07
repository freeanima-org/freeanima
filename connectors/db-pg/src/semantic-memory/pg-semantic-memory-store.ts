import type { SemanticMemoryStorePort } from "@freeanima/engine-repos";

import { pgProfileWrap } from "../pg-profile.ts";
import * as crudRepo from "./repos/semantic-crud-repo.ts";
import * as ftsRepo from "./repos/semantic-fts-repo.ts";
import * as searchRepo from "./repos/semantic-search-repo.ts";

/** PostgreSQL SemanticMemoryStorePort 实现 */
export class PgSemanticMemoryStore implements SemanticMemoryStorePort {
  async create(row: Parameters<SemanticMemoryStorePort["create"]>[0]) {
    return pgProfileWrap("semanticMemory.create", () => crudRepo.createSemanticMemory(row));
  }

  async get(id: string) {
    return pgProfileWrap("semanticMemory.get", () => crudRepo.getSemanticMemory(id));
  }

  async update(row: Parameters<SemanticMemoryStorePort["update"]>[0]) {
    return pgProfileWrap("semanticMemory.update", () => crudRepo.updateSemanticMemory(row));
  }

  async deprecate(id: string) {
    return pgProfileWrap("semanticMemory.deprecate", () => crudRepo.deprecateSemanticMemory(id));
  }

  async delete(id: string) {
    return pgProfileWrap("semanticMemory.delete", () => crudRepo.deleteSemanticMemory(id));
  }

  async count() {
    return pgProfileWrap("semanticMemory.count", () => crudRepo.countSemanticMemory());
  }

  async listResident(topN?: number) {
    return pgProfileWrap("semanticMemory.listResident", () =>
      crudRepo.listResidentSemanticMemory(topN),
    );
  }

  async listAll() {
    return pgProfileWrap("semanticMemory.listAll", () => crudRepo.listAllSemanticMemory());
  }

  async listBySourceSessions(
    sessionIds: string[],
    opts?: { status?: "active" | "deprecated" | "all" },
  ) {
    return pgProfileWrap("semanticMemory.listBySourceSessions", () =>
      crudRepo.listSemanticMemoryBySourceSessions(sessionIds, opts),
    );
  }

  async searchFts(query: string, opts?: { limit?: number; types?: string[] }) {
    return pgProfileWrap(
      "semanticMemory.searchFts",
      () => ftsRepo.searchSemanticMemoryFts(query, opts),
      { resultBytes: (rows) => JSON.stringify(rows).length },
    );
  }

  async search(opts: Parameters<SemanticMemoryStorePort["search"]>[0]) {
    return pgProfileWrap("semanticMemory.search", () => searchRepo.searchSemanticMemory(opts), {
      resultBytes: (rows) => JSON.stringify(rows).length,
    });
  }

  async findByContent(content: string) {
    return pgProfileWrap("semanticMemory.findByContent", () =>
      crudRepo.findSemanticMemoryByContent(content),
    );
  }
}
