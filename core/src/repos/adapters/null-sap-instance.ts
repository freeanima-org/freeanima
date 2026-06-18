import type { SapInstanceStorePort } from "../ports/sap-instance.ts";

export const nullSapInstanceStore: SapInstanceStorePort = {
  async get() {
    return null;
  },
  async upsert() {},
  async listAll() {
    return [];
  },
};
