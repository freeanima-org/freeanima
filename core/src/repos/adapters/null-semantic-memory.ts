import type { SemanticMemoryStorePort } from "../ports/semantic-memory.ts";

const unavailable = (): never => {
  throw new Error("database.url not configured");
};

/** Null semantic memory port when PG unavailable */
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
  async listActive() {
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
