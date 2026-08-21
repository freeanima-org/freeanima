import { createEnginePort } from "./engine-port-registry.ts";

export type SelfLayerRefreshEngineInput = {
  systemPrompt: string;
  userMessage: string;
  agent_subject_id: number;
};

export type SelfLayerRefreshEngineResult = {
  content: string;
};

export type SelfLayerRefreshEngineFn = (
  input: SelfLayerRefreshEngineInput,
) => Promise<SelfLayerRefreshEngineResult>;

const port = createEnginePort<SelfLayerRefreshEngineInput, SelfLayerRefreshEngineResult>(
  "Self-layer refresh LLM",
);

export const registerSelfLayerRefreshEngine = port.register.bind(port);
export const resetSelfLayerRefreshEngineForTests = port.resetForTests.bind(port);
export const runSelfLayerRefreshEngine = port.run.bind(port);
