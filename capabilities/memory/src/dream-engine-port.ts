export type DreamEngineInput = {
  systemPrompt: string;
  userMessage: string;
};

export type DreamEngineResult = {
  content: string;
};

export type DreamEngineFn = (input: DreamEngineInput) => Promise<DreamEngineResult>;

let engineFn: DreamEngineFn | null = null;

export function registerDreamEngine(fn: DreamEngineFn): void {
  engineFn = fn;
}

export function resetDreamEngineForTests(): void {
  engineFn = null;
}

export async function runDreamEngine(input: DreamEngineInput): Promise<DreamEngineResult> {
  if (!engineFn) {
    throw new Error("Dream LLM not configured: call registerDreamEngine() at service startup");
  }
  return engineFn(input);
}
