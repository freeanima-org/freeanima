import type { AutobiographicalMemoryStorePort } from "@freeanima/storage-repos";

import * as crudRepo from "./repos/autobiographical-crud-repo.ts";

/** PostgreSQL AutobiographicalMemoryStorePort implementation */
export class PgAutobiographicalMemoryStore implements AutobiographicalMemoryStorePort {
  async create(row: Parameters<AutobiographicalMemoryStorePort["create"]>[0]) {
    return crudRepo.createAutobiographicalMemory(row);
  }

  async get(id: string) {
    return crudRepo.getAutobiographicalMemory(id);
  }

  async deprecate(id: string) {
    return crudRepo.deprecateAutobiographicalMemory(id);
  }

  async count(opts?: Parameters<AutobiographicalMemoryStorePort["count"]>[0]) {
    return crudRepo.countAutobiographicalMemory(opts);
  }

  async listActive(opts?: Parameters<AutobiographicalMemoryStorePort["listActive"]>[0]) {
    return crudRepo.listActiveAutobiographicalMemory(opts);
  }

  async listCreatedSince(
    iso: string,
    opts?: Parameters<AutobiographicalMemoryStorePort["listCreatedSince"]>[1],
  ) {
    return crudRepo.listAutobiographicalMemoryCreatedSince(iso, opts);
  }

  async listBySourceSemanticMemory(
    semanticMemoryIds: string[],
    opts?: Parameters<AutobiographicalMemoryStorePort["listBySourceSemanticMemory"]>[1],
  ) {
    return crudRepo.listAutobiographicalMemoryBySourceSemanticMemory(semanticMemoryIds, opts);
  }

  async listBySourceSessions(
    sessionIds: string[],
    opts?: Parameters<AutobiographicalMemoryStorePort["listBySourceSessions"]>[1],
  ) {
    return crudRepo.listAutobiographicalMemoryBySourceSessions(sessionIds, opts);
  }

  async list(opts?: Parameters<AutobiographicalMemoryStorePort["list"]>[0]) {
    return crudRepo.listAutobiographicalMemory(opts);
  }
}
