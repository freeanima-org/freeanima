import type { SemanticMemoryStorePort, SessionStorePort } from "@freeanima/engine-repos";
import { registerMemorySessionStore } from "./session-port.ts";
import { registerSemanticMemoryStore } from "./semantic-port.ts";

/** 注册记忆管道依赖（session / semantic store） */
export function registerMemoryPipeline(opts: {
  sessionStore: SessionStorePort;
  semanticStore: SemanticMemoryStorePort;
}): void {
  registerMemorySessionStore(opts.sessionStore);
  registerSemanticMemoryStore(opts.semanticStore);
}
