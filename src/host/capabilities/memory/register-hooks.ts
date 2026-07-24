import type { Kernel } from "@freeanima/host/kernel";
import { beforeLlmCall } from "@freeanima/host/core/hooks/loop";

import { createPassiveMemoryRecallHandler } from "./passive-recall/handler.ts";

export function registerMemoryPassiveRecallHook(opts: { kernel: Kernel }): void {
  opts.kernel.hookRegistry.on(beforeLlmCall, createPassiveMemoryRecallHandler());
}
