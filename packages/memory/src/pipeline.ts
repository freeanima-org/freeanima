import { logComponent } from "@freeanima/legacy-kernel";
import type { EventBus } from "@freeanima/kernel-eventbus";
import { isDebugSession } from "@freeanima/legacy-kernel";
import { loadConfig } from "@freeanima/legacy-kernel";
import { distillFromPg } from "./clean";
import { l2Updated, l3Updated, sessionUpdated } from "./events";
import { indexL2Session } from "./l2-indexer";
import { indexL3All, indexL3Facts } from "./l3-indexer";
import { reflectSession } from "./reflect";

const DISTILL_DEBOUNCE_MS = 800;
const distillTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function isReflectEnabled(): boolean {
  const cfg = loadConfig();
  return cfg.memory?.reflect?.enabled === true;
}

export function registerMemoryPipeline(bus: EventBus): void {
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
            const result = await distillFromPg(sessionId, { ifNewer: true });
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
export function registerMemoryHandlers(bus: EventBus): void {
  registerMemoryPipeline(bus);
}

/** @deprecated 使用 registerMemoryPipeline */
export function registerEventHandlers(bus: EventBus): void {
  registerMemoryPipeline(bus);
}
