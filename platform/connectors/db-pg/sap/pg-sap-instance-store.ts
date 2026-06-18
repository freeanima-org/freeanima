import type { SapInstanceStorePort } from "@freeanima/core/repos";

import * as repo from "./repos/sap-instance-repo.ts";

export const pgSapInstanceStore: SapInstanceStorePort = {
  get: repo.getSapInstance,
  upsert: repo.upsertSapInstance,
  listAll: repo.listAllSapInstances,
};
