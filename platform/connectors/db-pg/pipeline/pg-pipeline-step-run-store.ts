import type { PipelineStepRunStorePort } from "@freeanima/core/repos";

import * as repo from "./repos/pipeline-step-run-repo.ts";

/** PostgreSQL PipelineStepRunStorePort implementation */
export const pgPipelineStepRunStore: PipelineStepRunStorePort = {
  append: repo.appendPipelineStepRun,
  list: repo.listPipelineStepRuns,
};
