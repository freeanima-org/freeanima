/**
 * Retain 的 LLM 薄端口（仅调模型+工具；策略在 builtin-retain）。
 */
import { createEnginePort } from "../engine-port-registry.ts";

export type RetainLlmInput = {
  systemPrompt: string;
  userMessages: string[];
  toolNames: string[];
};

export type RetainLlmResult = {
  summary: string;
  tool_calls: number;
  semantic_memory_ids: number[];
};

export type RetainLlmFn = (input: RetainLlmInput) => Promise<RetainLlmResult>;

const port = createEnginePort<RetainLlmInput, RetainLlmResult>("Retain LLM");

export const registerRetainLlm = port.register.bind(port);
export const resetRetainLlmForTests = port.resetForTests.bind(port);
export const runRetainLlm = port.run.bind(port);
export const isRetainLlmRegistered = port.isRegistered.bind(port);
