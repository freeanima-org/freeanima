export type SystemPromptBuilder = (
  functionNames: string[],
  soulContent: string,
  cwd?: string | null,
) => string;

let builder: SystemPromptBuilder | null = null;

/** 由 runtime/system-prompt-wire 启动时注入（避免 engine 依赖 memory） */
export function registerSystemPromptBuilder(fn: SystemPromptBuilder): void {
  builder = fn;
}

export function buildSystemPrompt(
  functionNames: string[],
  soulContent: string,
  cwd?: string | null,
): string {
  if (!builder) {
    throw new Error(
      "SystemPromptBuilder 未注册：请 import @freeanima/legacy-runtime/system-prompt-wire，或调用 registerSystemPromptBuilder",
    );
  }
  return builder(functionNames, soulContent, cwd);
}
