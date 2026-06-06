import { logComponent } from "@freeanima/service-logging";
import type { EventBus } from "@freeanima/kernel-eventbus";
import type { SessionStorePort } from "@freeanima/engine-repos";
import { isDebugSession } from "@freeanima/service-config";
import { loadConfig } from "@freeanima/service-config";
import { distillFromPg } from "./clean.ts";
import { l2Updated, l3Updated, sessionUpdated } from "./events.ts";
import { indexL2Session } from "./l2-indexer.ts";
import { indexL3All, indexL3Facts } from "./l3-indexer.ts";
import { reflectSession } from "./reflect.ts";

const DISTILL_DEBOUNCE_MS = 800;
const distillTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function isReflectEnabled(): boolean {
  const cfg = loadConfig();
  return cfg.memory?.reflect?.enabled === true;
}

export function registerMemoryPipeline(opts: {
  bus: EventBus;
  sessionStore: SessionStorePort;
}): void {
  const { bus, sessionStore } = opts;

  bus.on(sessionUpdated, async (payload) => {
    const sessionId = payload.session_id;
    if (!sessionId || isDebugSession(sessionId)) return;

    const existing = distillTimers.get(sessionId);
    if (existing) clearTimeout(existing);
    distillTimers.set(
      sessionId,
      setTimeout(() => {
        distillTimers.delete(sessionId);
        void (async () => {
          try {
            const result = await distillFromPg(sessionStore, sessionId, { ifNewer: true });
            if (result !== null) {
              bus.emit(l2Updated, { session_id: sessionId });
            }
          } catch (err) {
            logComponent("memory").error(`L2 distill failed for ${sessionId}`, { err });
          }
        })();
      }, DISTILL_DEBOUNCE_MS),
    );
  });

  bus.on(sessionUpdated, async (payload) => {
    if (!isReflectEnabled()) return;
    const sessionId = payload.session_id;
    if (!sessionId || isDebugSession(sessionId)) return;

    try {
      const { fact_ids } = await reflectSession(sessionId);
      if (fact_ids.length > 0) {
        bus.emit(l3Updated, { fact_ids });
      }
    } catch (err) {
      logComponent("memory").error(`Reflection failed for ${sessionId}`, { err });
    }
  });

  bus.on(l2Updated, async (payload) => {
    const sessionId = payload.session_id;
    if (!sessionId) return;
    try {
      indexL2Session(sessionId);
    } catch (err) {
      logComponent("memory").error(`L2 index failed for ${sessionId}`, { err });
    }
  });

  bus.on(l3Updated, async (payload) => {
    try {
      const raw = payload.fact_ids;
      if (Array.isArray(raw) && raw.length > 0) {
        const factIds = raw.map((id) => String(id)).filter(Boolean);
        indexL3Facts(factIds);
      } else {
        indexL3All();
      }
    } catch (err) {
      logComponent("memory").error("L3 index refresh failed", { err });
    }
  });
}

/** @deprecated 使用 registerMemoryPipeline */
export function registerMemoryHandlers(_bus: EventBus): void {
  throw new Error(
    "registerMemoryHandlers 已废弃：请使用 registerMemoryPipeline({ bus, sessionStore })",
  );
}

/** @deprecated 使用 registerMemoryPipeline */
export function registerEventHandlers(_bus: EventBus): void {
  throw new Error(
    "registerEventHandlers 已废弃：请使用 registerMemoryPipeline({ bus, sessionStore })",
  );
}
