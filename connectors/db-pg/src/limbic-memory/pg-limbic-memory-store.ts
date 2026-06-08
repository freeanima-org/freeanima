import type { LimbicMemoryStorePort } from "@freeanima/engine-repos";

import * as crudRepo from "./repos/limbic-crud-repo.ts";

/** PostgreSQL LimbicMemoryStorePort 实现 */
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
}
