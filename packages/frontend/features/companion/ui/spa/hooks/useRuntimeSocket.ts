import { useEffect } from "react";
import { resolveCompanionDevOrigin } from "@freeanima/features/companion/ui/spa/lib/companion-local.ts";
import { runtimeWsUrl } from "@freeanima/features/companion/ui/spa/lib/api.ts";
import { useCompanionStore } from "@freeanima/features/companion/ui/spa/stores/companion.ts";
import type { MotionSlotId } from "@freeanima/shared/companion-app/companion-schema.ts";
import { MOTION_SLOT_IDS } from "@freeanima/shared/companion-app/companion-schema.ts";

function isMotionSlotId(v: string): v is MotionSlotId {
  return (MOTION_SLOT_IDS as readonly string[]).includes(v);
}
import type { RuntimeWsMessage } from "@freeanima/shared/companion-app/constants.ts";

function applyRuntimeMessage(msg: RuntimeWsMessage): void {
  if (msg.type !== "runtime") return;
  useCompanionStore.getState().setRuntimeBubble(msg.bubble.current, msg.bubble.pending);
  const backend = useCompanionStore.getState().backendRef.current;
  for (const cmd of msg.play) {
    if (isMotionSlotId(cmd.slot)) backend?.playSlot(cmd.slot, cmd.motionId);
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
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse 边界
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
