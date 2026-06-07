import type { AutobiographicalMemoryStorePort } from "../ports/autobiographical-memory.ts";

const unavailable = (): never => {
  throw new Error("database.url 未配置");
};

/** PG 不可用时的自传体记忆端口空实现 */
export const nullAutobiographicalMemoryStore: AutobiographicalMemoryStorePort = {
  async create() {
    return unavailable();
  },
  async get() {
    return null;
  },
  async deprecate() {
    return unavailable();
  },
  async count() {
    return 0;
  },
  async listActive() {
    return [];
  },
  async listCreatedSince() {
    return [];
  },
  async listBySourceSemanticMemory() {
    return [];
  },
  async listBySourceSessions() {
    return [];
  },
};
