export type SystemPromptBuilder = (
  functionNames: string[],
  cwd?: string | null,
) => string | Promise<string>;

let builder: SystemPromptBuilder | null = null;

/** 由 runtime/system-prompt-wire 启动时注入（避免 engine 依赖 memory） */
export function registerSystemPromptBuilder(fn: SystemPromptBuilder): void {
  builder = fn;
}

export async function buildSystemPrompt(
  functionNames: string[],
  cwd?: string | null,
): Promise<string> {
  if (!builder) {
    throw new Error(
      "SystemPromptBuilder 未注册：请 import @freeanima/service/runtime/system-prompt-wire，或调用 registerSystemPromptBuilder",
    );
  }
  return builder(functionNames, cwd);
}
