/**
 * Reflect 的 LLM 薄端口（四轮巩固；策略在 builtin-reflect）。
 */
import type { DeepSleepChangeLog, DeepSleepRound } from "../deep-sleep/types.ts";
import { createEnginePort } from "../engine-port-registry.ts";

export type ReflectLlmInput = {
  systemPrompt: string;
  userMessages: string[];
  toolNames: string[];
  round: DeepSleepRound;
  changeLog: DeepSleepChangeLog;
};

export type ReflectLlmResult = {
  summary: string;
  tool_calls: number;
};

export type ReflectLlmFn = (input: ReflectLlmInput) => Promise<ReflectLlmResult>;

const port = createEnginePort<ReflectLlmInput, ReflectLlmResult>("Reflect LLM");

export const registerReflectLlm = port.register.bind(port);
export const resetReflectLlmForTests = port.resetForTests.bind(port);
export const runReflectLlm = port.run.bind(port);
export const isReflectLlmRegistered = port.isRegistered.bind(port);
