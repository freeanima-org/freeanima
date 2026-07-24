import { useEffect, useRef } from "react";
import {
  startCompanionRemoteToolsHost,
  type CompanionRemoteToolsStatus,
  type RemoteToolsHostHandle,
} from "../lib/remote-tools-host.ts";
import {
  enqueueBubble,
  setRuntimeBubbleListener,
  setRuntimePlayHandler,
} from "../lib/runtime-local.ts";
import { listenCompanionBubble } from "../lib/portal-shell.ts";
import { useCompanionStore } from "../stores/companion.ts";
import type { MotionSlotId } from "@freeanima/features/companion/shared/companion-schema.ts";

/**
 * Overlay WebView-host：挂载时 attach；shell config-changed 时重建。
 */
export function useRemoteToolsHost(enabled: boolean): void {
  const habitatUrl = useCompanionStore((s) => s.habitatUrl);
  const handleRef = useRef<RemoteToolsHostHandle | null>(null);

  useEffect(() => {
    if (!enabled) return;

    setRuntimeBubbleListener((current, pending) => {
      useCompanionStore.getState().setRuntimeBubble(current, pending);
    });
    setRuntimePlayHandler((slot, motionId) => {
      useCompanionStore.getState().backendRef.current?.playSlot(slot as MotionSlotId, motionId);
    });

    const applyStatus = (status: CompanionRemoteToolsStatus): void => {
      useCompanionStore.setState({
        instanceId: status.instance_id,
        sapConnected: status.remote_tools_connected,
      });
    };

    const start = (): void => {
      handleRef.current?.stop();
      const shell = window.portalShell;
      const httpUrl = shell?.apiOrigin ?? undefined;
      handleRef.current = startCompanionRemoteToolsHost({
        habitatUrl: useCompanionStore.getState().habitatUrl,
        ...(httpUrl ? { httpUrl } : {}),
        onStatus: applyStatus,
      });
    };

    start();
    const unsubConfig = window.portalShell?.listenConfigChanged?.(start);
    const unsubBubble = listenCompanionBubble((text) => {
      try {
        enqueueBubble(text);
      } catch {
        /* 空文本等由 enqueueBubble 抛出，测试按钮已 trim */
      }
    });

    return () => {
      unsubConfig?.();
      unsubBubble();
      handleRef.current?.stop();
      handleRef.current = null;
      setRuntimeBubbleListener(null);
      setRuntimePlayHandler(null);
    };
  }, [enabled, habitatUrl]);
}
