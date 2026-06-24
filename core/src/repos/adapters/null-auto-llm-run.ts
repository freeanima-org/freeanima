import type { AutoLlmRunStorePort } from "../ports/auto-llm-run.ts";

export const nullAutoLlmRunStore: AutoLlmRunStorePort = {
  async append() {},
  async purgeStale() {
    return { deleted: 0 };
  },
  async list() {
    return [];
  },
  async count() {
    return 0;
  },
};
