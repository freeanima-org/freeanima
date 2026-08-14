import type { Kernel } from "@freeanima/habitat/kernel";
import { beforeLlmCall } from "@freeanima/habitat/core/hooks/loop";

import { createPassiveMemoryRecallHandler } from "./passive-recall/handler.ts";

export function registerMemoryPassiveRecallHook(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createPassiveMemoryRecallHandler(), {
    llm_kind: "conversation",
  });
}
