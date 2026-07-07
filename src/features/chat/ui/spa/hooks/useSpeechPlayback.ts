import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { fetchHubConfig } from "@freeanima/shell-sdk/hub-config-api";
import {
  DEFAULT_SPEECH_PLAYBACK_CONFIG,
  parseSpeechConfigFromHub,
  type SpeechPlaybackConfig,
} from "@freeanima/shell-sdk/speech/types";
import { getAppLocale } from "@chat/lib/i18n.ts";
import { createBrowserSpeechAdapter } from "@chat/lib/speech/browser-adapter.ts";
import { createSpeechPlaybackController } from "@chat/lib/speech/controller.ts";
import type { SpeechPlaybackAdapter } from "@chat/lib/speech/types.ts";

export function useSpeechPlayback(adapter?: SpeechPlaybackAdapter) {
  const [speechConfig, setSpeechConfig] = useState<SpeechPlaybackConfig>(
    DEFAULT_SPEECH_PLAYBACK_CONFIG,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchHubConfig();
        if (!cancelled) {
          setSpeechConfig(parseSpeechConfigFromHub(data.tts));
        }
      } catch {
        /* 离线或 Hub 未配置时沿用默认 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const speechAdapter = useMemo(
    () => adapter ?? createBrowserSpeechAdapter(undefined, speechConfig),
    [adapter, speechConfig],
  );
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const controllerRef = useRef(createSpeechPlaybackController(speechAdapter, () => rerender()));

  useEffect(() => {
    controllerRef.current = createSpeechPlaybackController(speechAdapter, () => rerender());
  }, [speechAdapter]);

  const stop = useCallback(() => {
    controllerRef.current.stop();
  }, []);

  const toggle = useCallback((key: string, text: string) => {
    controllerRef.current.toggle(key, text, getAppLocale());
  }, []);

  const isSpeaking = useCallback((key: string) => controllerRef.current.isSpeaking(key), []);

  useEffect(() => () => controllerRef.current.stop(), []);

  return {
    toggle,
    stop,
    isSpeaking,
    isSupported: speechAdapter.isSupported(),
    activeKey: controllerRef.current.getActiveKey(),
  };
}
