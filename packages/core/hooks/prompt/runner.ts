import { omitUndefined } from "@freeanima/core/util";

import type { SystemPromptBuildContext } from "./hooks.ts";
import { resolveScenarioProfile } from "./scenario.ts";
import { getSystemPromptService } from "./service.ts";

/**
 * Build the folded system prompt by delegating to the mounted `SystemPromptService`.
 *
 * Engine 深处的调用方没有 ctx：服务实例由 `service.ts` 在挂载时登记，此处直接取用。
 */
export async function buildSystemPrompt(
  functionNames: string[],
  cwd?: string | null,
  meta?: SystemPromptBuildContext["meta"],
): Promise<string> {
  const service = getSystemPromptService();
  if (!service) {
    throw new Error("SystemPromptService not mounted: call serve() first");
  }
  const mode = resolveScenarioProfile(meta?.scenario).prompt;
  return service.build(omitUndefined({ functionNames, cwd, meta, mode }));
}
