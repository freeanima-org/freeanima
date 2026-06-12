import type { LimbicMemoryStorePort } from "@freeanima/storage-repos";

import * as crudRepo from "./repos/limbic-crud-repo.ts";
import * as listRepo from "./repos/limbic-list-repo.ts";

/** PostgreSQL LimbicMemoryStorePort implementation */
export class PgLimbicMemoryStore implements LimbicMemoryStorePort {
  async create(row: Parameters<LimbicMemoryStorePort["create"]>[0]) {
    return crudRepo.createLimbicMemory(row);
  }

  async get(id: string) {
    return crudRepo.getLimbicMemory(id);
  }

  async listBySession(
    sessionId: string,
    opts?: Parameters<LimbicMemoryStorePort["listBySession"]>[1],
  ) {
    return crudRepo.listLimbicMemoryBySession(sessionId, opts);
  }

  async list(opts?: Parameters<LimbicMemoryStorePort["list"]>[0]) {
    return listRepo.listLimbicMemory(opts);
  }

  async count(opts?: Parameters<LimbicMemoryStorePort["count"]>[0]) {
    return listRepo.countLimbicMemory(opts);
  }
}
