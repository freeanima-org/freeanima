export type SystemPromptBuilder = (
  functionNames: string[],
  soulContent: string,
  cwd?: string | null,
) => string;

let builder: SystemPromptBuilder | null = null;

/** 由 @freeanima/core 启动时注入（避免 engine 依赖 memory） */
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
      "SystemPromptBuilder 未注册：请通过 @freeanima/core 加载，或调用 registerSystemPromptBuilder",
    );
  }
  return builder(functionNames, soulContent, cwd);
}
