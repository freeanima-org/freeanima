import type { LimbicMemoryStorePort } from "@freeanima/engine-repos";

import { pgProfileWrap } from "../pg-profile.ts";
import * as crudRepo from "./repos/limbic-crud-repo.ts";

/** PostgreSQL LimbicMemoryStorePort 实现 */
export class PgLimbicMemoryStore implements LimbicMemoryStorePort {
  async create(row: Parameters<LimbicMemoryStorePort["create"]>[0]) {
    return pgProfileWrap("limbicMemory.create", () => crudRepo.createLimbicMemory(row));
  }

  async get(id: string) {
    return pgProfileWrap("limbicMemory.get", () => crudRepo.getLimbicMemory(id));
  }

  async listBySession(
    sessionId: string,
    opts?: Parameters<LimbicMemoryStorePort["listBySession"]>[1],
  ) {
    return pgProfileWrap("limbicMemory.listBySession", () =>
      crudRepo.listLimbicMemoryBySession(sessionId, opts),
    );
  }
}
