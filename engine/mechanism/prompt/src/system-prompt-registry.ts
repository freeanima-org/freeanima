export type SystemPromptBuilder = (
  functionNames: string[],
  cwd?: string | null,
) => string | Promise<string>;

let builder: SystemPromptBuilder | null = null;

/** Injected at runtime/system-prompt-wire startup (avoids engine depending on memory) */
export function registerSystemPromptBuilder(fn: SystemPromptBuilder): void {
  builder = fn;
}

export async function buildSystemPrompt(
  functionNames: string[],
  cwd?: string | null,
): Promise<string> {
  if (!builder) {
    throw new Error(
      "SystemPromptBuilder not registered: call wireEnginePorts() or registerSystemPromptBuilder",
    );
  }
  return builder(functionNames, cwd);
}
