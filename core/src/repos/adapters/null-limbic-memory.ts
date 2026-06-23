import type { LimbicMemoryStorePort } from "../ports/limbic-memory.ts";

const unavailable = (): never => {
  throw new Error("database.url not configured");
};

/** Null limbic memory port when PG unavailable */
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
  async listBySessions() {
    return [];
  },
  async list() {
    return [];
  },
  async count() {
    return 0;
  },
  async searchFts() {
    return [];
  },
};
