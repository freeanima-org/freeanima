import { createEnginePort } from "./engine-port-registry.ts";

export type LightSleepEngineStage = "semantic" | "limbic";

export type LightSleepEngineInput = {
  systemPrompt: string;
  userMessages: string[];
  toolNames: string[];
  stage: LightSleepEngineStage;
};

export type LightSleepEngineResult = {
  summary: string;
  tool_calls: number;
  semantic_memory_ids: number[];
  limbic_memory_ids: string[];
};

export type LightSleepEngineFn = (input: LightSleepEngineInput) => Promise<LightSleepEngineResult>;

const port = createEnginePort<LightSleepEngineInput, LightSleepEngineResult>("Light sleep LLM");

export const registerLightSleepEngine = port.register.bind(port);
export const resetLightSleepEngineForTests = port.resetForTests.bind(port);
export const runLightSleepEngine = port.run.bind(port);
