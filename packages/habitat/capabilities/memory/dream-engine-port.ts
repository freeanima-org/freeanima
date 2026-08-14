import { createEnginePort } from "./engine-port-registry.ts";

export type DreamEngineInput = {
  systemPrompt: string;
  userMessage: string;
};

export type DreamEngineResult = {
  content: string;
};

export type DreamEngineFn = (input: DreamEngineInput) => Promise<DreamEngineResult>;

const port = createEnginePort<DreamEngineInput, DreamEngineResult>("Dream LLM");

export const registerDreamEngine = port.register.bind(port);
export const resetDreamEngineForTests = port.resetForTests.bind(port);
export const runDreamEngine = port.run.bind(port);
