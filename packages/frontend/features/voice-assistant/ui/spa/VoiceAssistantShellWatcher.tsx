import { useEffect, useRef, useState } from "react";

import {
  isVoiceWakeSupported,
  listenVoiceWakeDetected,
  readVoiceWakePermission,
  startVoiceWake,
  stopVoiceWake,
} from "@freeanima/client/portal-sdk/voice-wake/index.ts";
import { readVoiceAssistantPrefs } from "@freeanima/client/portal-sdk/voice-assistant/prefs.ts";
import { runVoiceAssistantTurn } from "@freeanima/client/portal-sdk/voice-assistant/index.ts";
import { getShellBuildTarget } from "@freeanima/client/portal-sdk/shell-runtime.ts";

import { VoiceAssistantOverlay } from "./VoiceAssistantOverlay.tsx";

/** 移动壳：唤醒词监听 + 指令闭环 */
export function VoiceAssistantShellWatcher() {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (getShellBuildTarget() !== "mobile") return undefined;
    if (!isVoiceWakeSupported()) return undefined;

    let wakeListener: Awaited<ReturnType<typeof listenVoiceWakeDetected>> | undefined;
    let cancelled = false;

    const syncWake = async () => {
      const prefs = readVoiceAssistantPrefs();
      if (!prefs.wakeEnabled) {
        await stopVoiceWake();
        return;
      }
      const perm = await readVoiceWakePermission();
      if (perm !== "granted") return;
      await startVoiceWake({
        wakePhrase: prefs.wakePhrase,
        sensitivity: prefs.sensitivity,
      });
      if (cancelled) return;
      void wakeListener?.unregister();
      wakeListener = await listenVoiceWakeDetected(() => {
        if (busyRef.current) return;
        busyRef.current = true;
        setOverlayOpen(true);
        const current = readVoiceAssistantPrefs();
        void runVoiceAssistantTurn({ preferCloud: current.preferCloudAsr }).finally(() => {
          busyRef.current = false;
        });
      });
    };

    void syncWake();

    const onPrefs = () => {
      void syncWake();
    };
    window.addEventListener("freeanima:voice-assistant-prefs", onPrefs);

    return () => {
      cancelled = true;
      window.removeEventListener("freeanima:voice-assistant-prefs", onPrefs);
      void wakeListener?.unregister();
      void stopVoiceWake();
    };
  }, []);

  if (getShellBuildTarget() !== "mobile") return null;

  return <VoiceAssistantOverlay open={overlayOpen} onClose={() => setOverlayOpen(false)} />;
}
