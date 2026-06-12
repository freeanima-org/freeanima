import type { SessionMetaMessage } from "@freeanima/engine-db/domain";

export type SystemPromptBuildContext = {
  functionNames: string[];
  cwd?: string | null;
  meta?: SessionMetaMessage;
};

export type SystemPromptHookRunner = (ctx: SystemPromptBuildContext) => string | Promise<string>;

let runner: SystemPromptHookRunner | null = null;

/** Injected at composition root; runs systemPromptBuild hooks and folds sections */
export function registerSystemPromptHookRunner(fn: SystemPromptHookRunner): void {
  runner = fn;
}

export async function buildSystemPrompt(
  functionNames: string[],
  cwd?: string | null,
  meta?: SessionMetaMessage,
): Promise<string> {
  if (!runner) {
    throw new Error(
      "SystemPromptHookRunner not registered: call wireEnginePorts() or registerSystemPromptHookRunner",
    );
  }
  return runner({ functionNames, cwd, meta });
}

/** Unit test reset */
export function resetSystemPromptHookRunnerForTest(): void {
  runner = null;
}
