import type { AutoLlmRunStorePort } from "@freeanima/core/repos";

import * as repo from "./repos/auto-llm-run-repo.ts";

export const pgAutoLlmRunStore = {
  append: repo.appendAutoLlmRun,
  purgeStale: repo.purgeStaleAutoLlmRuns,
  list: repo.listAutoLlmRuns,
  count: repo.countAutoLlmRuns,
} satisfies AutoLlmRunStorePort;
