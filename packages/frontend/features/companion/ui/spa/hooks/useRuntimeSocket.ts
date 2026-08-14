import { useEffect } from "react";
import { resolveCompanionDevOrigin } from "@freeanima/features/companion/ui/spa/lib/companion-local.ts";
import { runtimeWsUrl } from "@freeanima/features/companion/ui/spa/lib/api.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import type { MotionSlotId } from "@freeanima/shared/companion-app/companion-schema.ts";
import type { RuntimeWsMessage } from "@freeanima/shared/companion-app/constants.ts";

function applyRuntimeMessage(msg: RuntimeWsMessage): void {
  if (msg.type !== "runtime") return;
  useCompanionStore.getState().setRuntimeBubble(msg.bubble.current, msg.bubble.pending);
  const backend = useCompanionStore.getState().backendRef.current;
  for (const cmd of msg.play) {
    backend?.playSlot(cmd.slot as MotionSlotId, cmd.motionId);
  }
}

/** companion/dev 本地 HTTP 经 WebSocket 推 runtime；Portal overlay 走本地 runtime（不连此 WS） */
export function useRuntimeSocket(enabled: boolean): void {
  const setRuntimeBubble = useCompanionStore((s) => s.setRuntimeBubble);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async (): Promise<void> => {
      if (cancelled || !enabled) return;
      try {
        const origin = await resolveCompanionDevOrigin();
        if (cancelled) return;
        ws = new WebSocket(runtimeWsUrl(origin));

        ws.addEventListener("message", (event: MessageEvent<string>): void => {
          let msg: RuntimeWsMessage;
          try {
            msg = JSON.parse(event.data) as RuntimeWsMessage;
          } catch {
            return;
          }
          applyRuntimeMessage(msg);
        });

        ws.addEventListener("close", (): void => {
          if (!cancelled) {
            retryTimer = setTimeout(() => void connect(), 2000);
          }
        });
      } catch {
        if (!cancelled) {
          retryTimer = setTimeout(() => void connect(), 2000);
        }
      }
    };

    if (enabled) void connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [enabled, setRuntimeBubble]);
}
