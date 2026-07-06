import { createEnginePort } from "./engine-port-registry.ts";
import type { DeepSleepChangeLog } from "./deep-sleep/types.ts";

/** Deep sleep single-round LLM input (similar to light sleep, but userMessages has 4 entries) */
export type DeepSleepEngineInput = {
  systemPrompt: string;
  userMessages: [string, string, string, string];
  toolNames: string[];
  changeLog?: DeepSleepChangeLog;
};

export type DeepSleepEngineResult = {
  summary: string;
  tool_calls: number;
};

export type DeepSleepEngineFn = (input: DeepSleepEngineInput) => Promise<DeepSleepEngineResult>;

const port = createEnginePort<DeepSleepEngineInput, DeepSleepEngineResult>("Deep sleep LLM");

export const registerDeepSleepEngine = port.register.bind(port);
export const resetDeepSleepEngineForTests = port.resetForTests.bind(port);
export const runDeepSleepEngine = port.run.bind(port);
