import type { Kernel } from "@freeanima/kernel";

/** Start EventBus (memory store must be injected via registerServiceStores) */
export function registerServiceMemoryBus(opts: { kernel: Kernel }): void {
  opts.kernel.eventBus.start();
}
