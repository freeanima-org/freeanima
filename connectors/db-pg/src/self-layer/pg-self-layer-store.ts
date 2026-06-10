import type { SelfLayerStorePort } from "@freeanima/engine-repos";

import * as crudRepo from "./repos/self-crud-repo.ts";

/** PostgreSQL SelfLayerStorePort implementation */
export class PgSelfLayerStore implements SelfLayerStorePort {
  async getBlock(key: Parameters<SelfLayerStorePort["getBlock"]>[0]) {
    return crudRepo.getSelfBlock(key);
  }

  async listBlocks() {
    return crudRepo.listSelfBlocks();
  }

  async upsertBlock(input: Parameters<SelfLayerStorePort["upsertBlock"]>[0]) {
    return crudRepo.upsertSelfBlock(input);
  }

  async updateBlock(
    input: Parameters<SelfLayerStorePort["updateBlock"]>[0],
    opts?: Parameters<SelfLayerStorePort["updateBlock"]>[1],
  ) {
    return crudRepo.updateSelfBlock(input, opts);
  }
}
