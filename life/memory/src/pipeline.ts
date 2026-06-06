import { logComponent } from "@freeanima/service-logging";
import type { EventBus } from "@freeanima/kernel-eventbus";
import type { SemanticMemoryStorePort, SessionStorePort } from "@freeanima/engine-repos";
import { isDebugSession } from "@freeanima/service-config";
import { loadConfig } from "@freeanima/service-config";
import { l3Updated, sessionUpdated } from "./events.ts";
import { reflectSession } from "./reflect.ts";
import { registerMemorySessionStore } from "./session-port.ts";
import { registerSemanticMemoryStore } from "./semantic-port.ts";

export function isReflectEnabled(): boolean {
  const cfg = loadConfig();
  return cfg.memory?.reflect?.enabled === true;
}

export function registerMemoryPipeline(opts: {
  bus: EventBus;
  sessionStore: SessionStorePort;
  semanticStore: SemanticMemoryStorePort;
}): void {
  const { bus, sessionStore, semanticStore } = opts;
  registerMemorySessionStore(sessionStore);
  registerSemanticMemoryStore(semanticStore);

  bus.on(sessionUpdated, async (payload) => {
    if (!isReflectEnabled()) return;
    const sessionId = payload.session_id;
    if (!sessionId || isDebugSession(sessionId)) return;

    try {
      const { fact_ids } = await reflectSession(sessionId, sessionStore);
      if (fact_ids.length > 0) {
        bus.emit(l3Updated, { fact_ids });
      }
    } catch (err) {
      logComponent("memory").error(`Reflection failed for ${sessionId}`, { err });
    }
  });
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
