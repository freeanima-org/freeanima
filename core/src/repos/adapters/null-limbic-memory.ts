import type { LimbicMemoryStorePort } from "../ports/limbic-memory.ts";

import { pgUnavailable } from "./null-helpers.ts";

const unavailable = pgUnavailable;

/** Null limbic memory port when PG unavailable */
export const nullLimbicMemoryStore: LimbicMemoryStorePort = {
  async create() {
    return unavailable();
  },
  async get() {
    return null;
  },
  async listByConversation() {
    return [];
  },
  async listByConversations() {
    return [];
  },
  async listByCreatedBetween() {
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
