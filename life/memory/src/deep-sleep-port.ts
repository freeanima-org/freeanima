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

let engineFn: DeepSleepEngineFn | null = null;

export function registerDeepSleepEngine(fn: DeepSleepEngineFn): void {
  engineFn = fn;
}

export function resetDeepSleepEngineForTests(): void {
  engineFn = null;
}

export async function runDeepSleepEngine(
  input: DeepSleepEngineInput,
): Promise<DeepSleepEngineResult> {
  if (!engineFn) {
    throw new Error(
      "Deep sleep LLM not configured: call registerDeepSleepEngine() at service startup",
    );
  }
  return engineFn(input);
}
