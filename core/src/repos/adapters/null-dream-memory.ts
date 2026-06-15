import type { DreamMemoryStorePort } from "../ports/dream-memory.ts";

const unavailable = (): never => {
  throw new Error("database.url not configured");
};

/** Null dream memory port when PG unavailable */
export const nullDreamMemoryStore: DreamMemoryStorePort = {
  async create() {
    return unavailable();
  },
  async getByDay() {
    return null;
  },
  async getLatest() {
    return null;
  },
  async list() {
    return [];
  },
  async count() {
    return 0;
  },
};
