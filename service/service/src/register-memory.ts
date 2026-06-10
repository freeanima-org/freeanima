import type { Kernel } from "@freeanima/kernel";

/** 启动 EventBus（记忆 store 须已通过 registerServiceStores 注入） */
export function registerServiceMemoryBus(opts: { kernel: Kernel }): void {
  opts.kernel.eventBus.start();
}
