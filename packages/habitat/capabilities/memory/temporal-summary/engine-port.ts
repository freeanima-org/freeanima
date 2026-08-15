import { createEnginePort } from "../engine-port-registry.ts";

export type TemporalSummaryEngineInput = {
  /** 已含 protocol + task_spec 的 system */
  systemPrompt: string;
  /** 已含 task_params / source_data 等 user 段 */
  userMessages: string[];
};

export type TemporalSummaryEngineResult = {
  content: string;
};

const port = createEnginePort<TemporalSummaryEngineInput, TemporalSummaryEngineResult>(
  "Temporal summary LLM",
);

export const registerTemporalSummaryEngine = port.register.bind(port);
export const resetTemporalSummaryEngineForTests = port.resetForTests.bind(port);
export const runTemporalSummaryEngine = port.run.bind(port);
