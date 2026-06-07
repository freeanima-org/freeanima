import type { LimbicMemoryStorePort } from "../ports/limbic-memory.ts";

const unavailable = (): never => {
  throw new Error("database.url 未配置");
};

/** PG 不可用时的边缘系统记忆端口空实现 */
export const nullLimbicMemoryStore: LimbicMemoryStorePort = {
  async create() {
    return unavailable();
  },
  async get() {
    return null;
  },
  async listBySession() {
    return [];
  },
};
