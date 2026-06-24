import type { AutobiographicalMemoryStorePort } from "../ports/autobiographical-memory.ts";

const unavailable = (): never => {
  throw new Error("database.url not configured");
};

/** Null autobiographical memory port when PG unavailable */
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
  async listBySourceConversations() {
    return [];
  },
  async list() {
    return [];
  },
  async searchFts() {
    return [];
  },
};
