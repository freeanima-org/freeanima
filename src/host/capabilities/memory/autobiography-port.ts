import { createEnginePort } from "./engine-port-registry.ts";

export type AutobiographyEngineInput = {
  systemPrompt: string;
  userMessages: string[];
  toolNames: string[];
};

export type AutobiographyEngineResult = {
  summary: string;
  tool_calls: number;
};

export type AutobiographyEngineFn = (
  input: AutobiographyEngineInput,
) => Promise<AutobiographyEngineResult>;

const port = createEnginePort<AutobiographyEngineInput, AutobiographyEngineResult>(
  "Autobiography cron LLM",
);

export const registerAutobiographyEngine = port.register.bind(port);
export const resetAutobiographyEngineForTests = port.resetForTests.bind(port);
export const runAutobiographyEngine = port.run.bind(port);
