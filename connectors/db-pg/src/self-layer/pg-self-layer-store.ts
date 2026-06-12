import type { SelfLayerStorePort } from "@freeanima/core/repos";

import * as crudRepo from "./repos/self-crud-repo.ts";

/** PostgreSQL SelfLayerStorePort implementation */
export const pgSelfLayerStore: SelfLayerStorePort = {
  getBlock: crudRepo.getSelfBlock,
  listBlocks: crudRepo.listSelfBlocks,
  upsertBlock: crudRepo.upsertSelfBlock,
  updateBlock: crudRepo.updateSelfBlock,
};
