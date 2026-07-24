import { omitUndefined } from "@freeanima/host/core/util";

import type { SystemPromptBuildContext } from "./hooks.ts";

export type SystemPromptHookRunner = (ctx: SystemPromptBuildContext) => string | Promise<string>;

let runner: SystemPromptHookRunner | null = null;

/** Injected at composition root; runs systemPromptBuild hooks and folds sections */
export function registerSystemPromptHookRunner(fn: SystemPromptHookRunner): void {
  runner = fn;
}

export async function buildSystemPrompt(
  functionNames: string[],
  cwd?: string | null,
  meta?: SystemPromptBuildContext["meta"],
): Promise<string> {
  if (!runner) {
    throw new Error(
      "SystemPromptHookRunner not registered: call bindEnginePorts() or registerSystemPromptHookRunner",
    );
  }
  return runner(omitUndefined({ functionNames, cwd, meta }));
}

/** Unit test reset */
export function resetSystemPromptHookRunnerForTest(): void {
  runner = null;
}
