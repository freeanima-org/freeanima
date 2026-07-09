import { useEffect } from "react";
import { resolveSidecarOrigin } from "@freeanima/satellites/companion/spa/lib/sidecar.ts";
import { runtimeWsUrl } from "@freeanima/satellites/companion/spa/lib/api.ts";
import { useCompanionStore } from "@freeanima/satellites/companion/spa/stores/companion.ts";
import type { MotionSlotId } from "@freeanima/satellites/companion/shared/companion-schema.ts";
import type { RuntimeWsMessage } from "@freeanima/satellites/companion/shared/constants.ts";

export function useRuntimeSocket(enabled: boolean): void {
  const setRuntimeBubble = useCompanionStore((s) => s.setRuntimeBubble);

  useEffect(() => {
    if (!enabled) return;

    let ws: WebSocket | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const origin = await resolveSidecarOrigin();
        if (cancelled) return;
        ws = new WebSocket(runtimeWsUrl(origin));

        ws.addEventListener("message", (event: MessageEvent<string>): void => {
          let msg: RuntimeWsMessage;
          try {
            msg = JSON.parse(event.data) as RuntimeWsMessage;
          } catch {
            return;
          }
          if (msg.type !== "runtime") return;

          setRuntimeBubble(msg.bubble.current, msg.bubble.pending);

          const backend = useCompanionStore.getState().backendRef.current;
          for (const cmd of msg.play) {
            backend?.playSlot(cmd.slot as MotionSlotId, cmd.motionId);
          }
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

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [enabled, setRuntimeBubble]);
}
