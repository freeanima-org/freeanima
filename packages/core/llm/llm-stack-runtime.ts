import type { RuntimeConfig } from "@freeanima/core/config";

import { createLlmRuntime, type LlmRuntime } from "./llm-stack.ts";

let runtime: LlmRuntime | null = null;

/** Build the LLM runtime from config (boot + runtime config apply). */
export function initLlmRuntime(cfg: RuntimeConfig): LlmRuntime {
  runtime = createLlmRuntime(cfg);
  return runtime;
}

/** The active LLM runtime, or throw when `initLlmRuntime` has not run. */
export function getLlmRuntime(): LlmRuntime {
  if (!runtime) {
    throw new Error("LLM runtime not initialized: call initLlmRuntime() first");
  }
  return runtime;
}

export function resetLlmRuntimeForTests(): void {
  runtime = null;
}
