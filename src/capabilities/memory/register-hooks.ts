import type { Kernel } from "@freeanima/kernel";
import { beforeLlmCall } from "@freeanima/core/hooks/loop";

import { createPassiveMemoryRecallHandler } from "./passive-recall/handler.ts";

export function registerMemoryPassiveRecallHook(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createPassiveMemoryRecallHandler());
}
