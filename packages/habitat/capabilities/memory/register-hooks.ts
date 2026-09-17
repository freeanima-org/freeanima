import type { Kernel } from "@freeanima/kernel";
import { onBeforeLlmCall } from "@freeanima/habitat/core/hooks/cordis";

import { createPassiveMemoryRecallHandler } from "./passive-recall/handler.ts";

export function registerMemoryPassiveRecallHook(opts: { kernel: Kernel }): void {
  onBeforeLlmCall(opts.kernel.ctx, createPassiveMemoryRecallHandler());
}
