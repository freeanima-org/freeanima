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

let engineFn: AutobiographyEngineFn | null = null;

export function registerAutobiographyEngine(fn: AutobiographyEngineFn): void {
  engineFn = fn;
}

export function resetAutobiographyEngineForTests(): void {
  engineFn = null;
}

export async function runAutobiographyEngine(
  input: AutobiographyEngineInput,
): Promise<AutobiographyEngineResult> {
  if (!engineFn) {
    throw new Error(
      "Autobiography cron LLM not configured: call registerAutobiographyEngine() at service startup",
    );
  }
  return engineFn(input);
}
