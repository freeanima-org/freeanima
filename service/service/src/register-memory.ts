import type { Kernel } from "@freeanima/kernel";
import type { SemanticMemoryStorePort, SessionStorePort } from "@freeanima/engine-repos";
import { registerMemoryPipeline } from "@freeanima/life-memory";

/** 注册记忆 store 并启动 EventBus */
export function registerServiceMemoryBus(opts: {
  kernel: Kernel;
  sessionStore: SessionStorePort;
  semanticStore: SemanticMemoryStorePort;
}): void {
  registerMemoryPipeline({
    sessionStore: opts.sessionStore,
    semanticStore: opts.semanticStore,
  });
  opts.kernel.eventBus.start();
}
