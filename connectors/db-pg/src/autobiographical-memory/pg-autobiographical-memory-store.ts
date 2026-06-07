import type { AutobiographicalMemoryStorePort } from "@freeanima/engine-repos";

import { pgProfileWrap } from "../pg-profile.ts";
import * as crudRepo from "./repos/autobiographical-crud-repo.ts";

/** PostgreSQL AutobiographicalMemoryStorePort 实现 */
export class PgAutobiographicalMemoryStore implements AutobiographicalMemoryStorePort {
  async create(row: Parameters<AutobiographicalMemoryStorePort["create"]>[0]) {
    return pgProfileWrap("autobiographicalMemory.create", () =>
      crudRepo.createAutobiographicalMemory(row),
    );
  }

  async get(id: string) {
    return pgProfileWrap("autobiographicalMemory.get", () =>
      crudRepo.getAutobiographicalMemory(id),
    );
  }

  async deprecate(id: string) {
    return pgProfileWrap("autobiographicalMemory.deprecate", () =>
      crudRepo.deprecateAutobiographicalMemory(id),
    );
  }

  async count(opts?: Parameters<AutobiographicalMemoryStorePort["count"]>[0]) {
    return pgProfileWrap("autobiographicalMemory.count", () =>
      crudRepo.countAutobiographicalMemory(opts),
    );
  }

  async listActive(opts?: Parameters<AutobiographicalMemoryStorePort["listActive"]>[0]) {
    return pgProfileWrap("autobiographicalMemory.listActive", () =>
      crudRepo.listActiveAutobiographicalMemory(opts),
    );
  }

  async listCreatedSince(
    iso: string,
    opts?: Parameters<AutobiographicalMemoryStorePort["listCreatedSince"]>[1],
  ) {
    return pgProfileWrap("autobiographicalMemory.listCreatedSince", () =>
      crudRepo.listAutobiographicalMemoryCreatedSince(iso, opts),
    );
  }

  async listBySourceSemanticMemory(
    semanticMemoryIds: string[],
    opts?: Parameters<AutobiographicalMemoryStorePort["listBySourceSemanticMemory"]>[1],
  ) {
    return pgProfileWrap("autobiographicalMemory.listBySourceSemanticMemory", () =>
      crudRepo.listAutobiographicalMemoryBySourceSemanticMemory(semanticMemoryIds, opts),
    );
  }

  async listBySourceSessions(
    sessionIds: string[],
    opts?: Parameters<AutobiographicalMemoryStorePort["listBySourceSessions"]>[1],
  ) {
    return pgProfileWrap("autobiographicalMemory.listBySourceSessions", () =>
      crudRepo.listAutobiographicalMemoryBySourceSessions(sessionIds, opts),
    );
  }
}
