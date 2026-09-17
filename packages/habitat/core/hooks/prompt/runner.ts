import { getRootContextOrNull } from "@freeanima/kernel";
import { omitUndefined } from "@freeanima/habitat/core/util";

import type { SystemPromptBuildContext } from "./hooks.ts";
import { resolveScenarioProfile } from "./scenario.ts";

/**
 * Build the folded system prompt by delegating to `ctx.systemPrompt`.
 *
 * Consumers deep in engine code call this without a context; the Cordis
 * `SystemPromptService` is resolved from the process context.
 */
export async function buildSystemPrompt(
  functionNames: string[],
  cwd?: string | null,
  meta?: SystemPromptBuildContext["meta"],
): Promise<string> {
  const ctx = getRootContextOrNull();
  if (!ctx) {
    throw new Error("Process context not initialized: cannot build system prompt before serve()");
  }
  const service = ctx.systemPrompt;
  if (!service) {
    throw new Error("SystemPromptService not mounted: call serve() first");
  }
  const mode = resolveScenarioProfile(meta?.scenario).prompt;
  return service.build(omitUndefined({ functionNames, cwd, meta, mode }));
}
