export type LightSleepEngineInput = {
  systemPrompt: string;
  userMessages: string[];
  toolNames: string[];
};

export type LightSleepEngineResult = {
  summary: string;
  tool_calls: number;
  semantic_memory_ids: string[];
  limbic_memory_ids: string[];
};

export type LightSleepEngineFn = (input: LightSleepEngineInput) => Promise<LightSleepEngineResult>;

let engineFn: LightSleepEngineFn | null = null;

export function registerLightSleepEngine(fn: LightSleepEngineFn): void {
  engineFn = fn;
}

export function resetLightSleepEngineForTests(): void {
  engineFn = null;
}

export async function runLightSleepEngine(
  input: LightSleepEngineInput,
): Promise<LightSleepEngineResult> {
  if (!engineFn) {
    throw new Error("浅睡 LLM 未配置：请在服务启动时调用 registerLightSleepEngine()");
  }
  return engineFn(input);
}
