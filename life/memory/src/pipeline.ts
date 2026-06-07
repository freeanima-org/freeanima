import type { EventBus } from "@freeanima/kernel-eventbus";
import type { SemanticMemoryStorePort, SessionStorePort } from "@freeanima/engine-repos";
import { registerMemorySessionStore } from "./session-port.ts";
import { registerSemanticMemoryStore } from "./semantic-port.ts";

/** 注册记忆管道依赖（session / semantic store）；保留 session:updated 事件，不再订阅 reflect */
export function registerMemoryPipeline(opts: {
  bus: EventBus;
  sessionStore: SessionStorePort;
  semanticStore: SemanticMemoryStorePort;
}): void {
  registerMemorySessionStore(opts.sessionStore);
  registerSemanticMemoryStore(opts.semanticStore);
}

/** @deprecated 使用 registerMemoryPipeline */
export function registerMemoryHandlers(_bus: EventBus): void {
  throw new Error(
    "registerMemoryHandlers 已废弃：请使用 registerMemoryPipeline({ bus, sessionStore, semanticStore })",
  );
}

/** @deprecated 使用 registerMemoryPipeline */
export function registerEventHandlers(_bus: EventBus): void {
  throw new Error(
    "registerEventHandlers 已废弃：请使用 registerMemoryPipeline({ bus, sessionStore, semanticStore })",
  );
}
