/** 深睡单轮 LLM 调用输入（与浅睡类似，但 userMessages 为 4 条） */
export type DeepSleepEngineInput = {
  systemPrompt: string;
  userMessages: [string, string, string, string];
  toolNames: string[];
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
    throw new Error("深睡 LLM 未配置：请在服务启动时调用 registerDeepSleepEngine()");
  }
  return engineFn(input);
}
