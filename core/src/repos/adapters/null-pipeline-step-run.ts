import type { PipelineStepRunStorePort } from "../ports/pipeline-step-run.ts";

const noop = async (): Promise<void> => {};

export const nullPipelineStepRunStore: PipelineStepRunStorePort = {
  append: noop,
  list: async () => [],
};
