import { logError } from "@freeanima/legacy-kernel";
import type { EventBus } from "@freeanima/legacy-kernel";
import { isDebugSession } from "@freeanima/legacy-kernel";
import { loadConfig } from "@freeanima/legacy-kernel";
import { distillFromPg } from "./clean";
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
  bus.on("session:updated", async (payload) => {
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
              bus.emit("l2:updated", { session_id: sessionId });
            }
          } catch (err) {
            logError(`L2 distill failed for ${sessionId}`, { source: "memory", error: err });
          }
        })();
      }, DISTILL_DEBOUNCE_MS),
    );
  });

  bus.on("session:updated", async (payload) => {
    if (!isReflectEnabled()) return;
    const sessionId = payload.session_id;
    if (!sessionId || isDebugSession(sessionId)) return;

    try {
      const { fact_ids } = await reflectSession(sessionId);
      if (fact_ids.length > 0) {
        bus.emit("l3:updated", { fact_ids });
      }
    } catch (err) {
      logError(`Reflection failed for ${sessionId}`, { source: "memory", error: err });
    }
  });

  bus.on("l2:updated", async (payload) => {
    const sessionId = payload.session_id;
    if (!sessionId) return;
    try {
      indexL2Session(sessionId);
    } catch (err) {
      logError(`L2 index failed for ${sessionId}`, { source: "memory", error: err });
    }
  });

  bus.on("l3:updated", async (payload) => {
    try {
      const raw = payload.fact_ids;
      if (Array.isArray(raw) && raw.length > 0) {
        const factIds = raw.map((id) => String(id)).filter(Boolean);
        indexL3Facts(factIds);
      } else {
        indexL3All();
      }
    } catch (err) {
      logError("L3 index refresh failed", { source: "memory", error: err });
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
