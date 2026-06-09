import type { SemanticMemoryStorePort } from "../ports/semantic-memory.ts";

const unavailable = (): never => {
  throw new Error("database.url 未配置");
};

/** PG 不可用时的语义记忆端口空实现 */
export const nullSemanticMemoryStore: SemanticMemoryStorePort = {
  async create() {
    return unavailable();
  },
  async get() {
    return null;
  },
  async update() {
    return unavailable();
  },
  async deprecate() {
    return unavailable();
  },
  async delete() {
    return false;
  },
  async count() {
    return 0;
  },
  async listResident() {
    return [];
  },
  async listAll() {
    return [];
  },
  async listBySourceSessions() {
    return [];
  },
  async searchFts() {
    return [];
  },
  async search() {
    return [];
  },
  async countSearch() {
    return 0;
  },
  async findByContent() {
    return null;
  },
};
