import type { RuntimeConfig } from "@freeanima/core/config";
import { getRootContextOrNull } from "@freeanima/kernel";

import type { LlmRuntime } from "./llm-stack.ts";
import type { LlmStackService } from "./llm-stack-service.ts";

function requireService(): LlmStackService {
  const service = getRootContextOrNull()?.llmStack;
  if (!service) {
    throw new Error("LlmStackService not mounted: load @freeanima/platform first");
  }
  return service;
}

/** Build the LLM runtime from config and store it on `ctx.llmStack`. */
export function initLlmRuntime(cfg: RuntimeConfig): LlmRuntime {
  return requireService().initRuntime(cfg);
}

/** The active LLM runtime, or throw when `initLlmRuntime` has not run. */
export function getLlmRuntime(): LlmRuntime {
  return requireService().getRuntime();
}

export function resetLlmRuntimeForTests(): void {
  getRootContextOrNull()?.llmStack?.reset();
}
