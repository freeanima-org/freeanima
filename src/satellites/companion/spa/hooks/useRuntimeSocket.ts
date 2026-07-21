import { useEffect } from "react";
import { resolveSidecarOrigin } from "@freeanima/satellites/companion/spa/lib/sidecar.ts";
import { runtimeWsUrl } from "@freeanima/satellites/companion/spa/lib/api.ts";
import { isElectron } from "@freeanima/satellites/companion/spa/lib/electron.ts";
import { useCompanionStore } from "@freeanima/satellites/companion/spa/stores/companion.ts";
import type { MotionSlotId } from "@freeanima/satellites/companion/shared/companion-schema.ts";
import type { RuntimeWsMessage } from "@freeanima/satellites/companion/shared/constants.ts";

function applyRuntimeMessage(msg: RuntimeWsMessage): void {
  if (msg.type !== "runtime") return;
  useCompanionStore.getState().setRuntimeBubble(msg.bubble.current, msg.bubble.pending);
  const backend = useCompanionStore.getState().backendRef.current;
  for (const cmd of msg.play) {
    backend?.playSlot(cmd.slot as MotionSlotId, cmd.motionId);
  }
}

export function useRuntimeSocket(enabled: boolean): void {
  const setRuntimeBubble = useCompanionStore((s) => s.setRuntimeBubble);

  useEffect(() => {
    if (!enabled) return;

    const shell = window.satelliteShell;
    if (isElectron() && shell?.listenCompanionRuntime) {
      let cancelled = false;
      const unsub = shell.listenCompanionRuntime((message) => {
        applyRuntimeMessage(message as RuntimeWsMessage);
      });
      void shell.getCompanionRuntimeSnapshot?.().then((snap) => {
        if (!cancelled && snap) applyRuntimeMessage(snap as RuntimeWsMessage);
      });
      return () => {
        cancelled = true;
        unsub();
      };
    }

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

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [enabled, setRuntimeBubble]);
}
