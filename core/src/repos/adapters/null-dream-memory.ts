import type { DreamMemoryStorePort } from "../ports/dream-memory.ts";

import { pgUnavailable } from "./null-helpers.ts";

const unavailable = pgUnavailable;

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
