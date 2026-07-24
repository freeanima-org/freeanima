import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { fetchHabitatConfig } from "@freeanima/frontend/portal-sdk/habitat-config-api";
import { createSpeechAdapter } from "@freeanima/frontend/portal-sdk/speech/create-adapter";
import {
  DEFAULT_SPEECH_PLAYBACK_CONFIG,
  parseSpeechConfigFromHub,
  type SpeechPlaybackConfig,
} from "@freeanima/frontend/portal-sdk/speech/types";
import { getWebSpeechUnsupportedReason } from "@freeanima/frontend/portal-sdk/speech/web-speech-support";
import { consumeLastHubSpeechError } from "@freeanima/frontend/portal-sdk/speech/habitat-adapter";
import { getAppLocale, m } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";
import { createSpeechPlaybackController } from "@freeanima/features/chat/ui/spa/lib/speech/controller.ts";
import type { SpeechPlaybackAdapter } from "@freeanima/features/chat/ui/spa/lib/speech/types.ts";

function wrapAdapterWithErrorHandler(
  adapter: SpeechPlaybackAdapter,
  onPlaybackError: () => void,
): SpeechPlaybackAdapter {
  return {
    isSupported: () => adapter.isSupported(),
    stop: () => adapter.stop(),
    speak(text, locale, onEnd, onError) {
      adapter.speak(text, locale, onEnd, () => {
        onPlaybackError();
        onError?.();
      });
    },
  };
}

export function useSpeechPlayback(adapter?: SpeechPlaybackAdapter) {
  const [speechConfig, setSpeechConfig] = useState<SpeechPlaybackConfig>(
    DEFAULT_SPEECH_PLAYBACK_CONFIG,
  );
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const playbackErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPlaybackError = useCallback(() => {
    const detail = consumeLastHubSpeechError();
    setPlaybackError(detail ?? m.chat_speech_playback_failed());
    if (playbackErrorTimerRef.current != null) clearTimeout(playbackErrorTimerRef.current);
    playbackErrorTimerRef.current = setTimeout(() => setPlaybackError(null), 4000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchHabitatConfig();
        if (!cancelled) {
          setSpeechConfig(parseSpeechConfigFromHub(data.tts));
        }
      } catch {
        /* 离线或 Habitat 未配置时沿用默认 */
      }
    })();
    return () => {
      cancelled = true;
      if (playbackErrorTimerRef.current != null) clearTimeout(playbackErrorTimerRef.current);
    };
  }, []);

  const speechAdapter = useMemo(() => {
    const base = adapter ?? createSpeechAdapter(speechConfig);
    return wrapAdapterWithErrorHandler(base, showPlaybackError);
  }, [adapter, showPlaybackError, speechConfig]);

  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const controllerRef = useRef(createSpeechPlaybackController(speechAdapter, () => rerender()));

  useEffect(() => {
    controllerRef.current = createSpeechPlaybackController(speechAdapter, () => rerender());
  }, [speechAdapter]);

  const stop = useCallback(() => {
    controllerRef.current.stop();
  }, []);

  const toggle = useCallback((key: string, text: string) => {
    setPlaybackError(null);
    controllerRef.current.toggle(key, text, getAppLocale());
  }, []);

  const isSpeaking = useCallback((key: string) => controllerRef.current.isSpeaking(key), []);

  const unsupportedReason = useMemo(() => {
    if (!speechConfig.enabled) return "disabled" as const;
    if (speechConfig.provider === "edge-tts") return null;
    return getWebSpeechUnsupportedReason(true);
  }, [speechConfig.enabled, speechConfig.provider]);

  const isSupported = speechAdapter.isSupported();

  useEffect(() => () => controllerRef.current.stop(), []);

  return {
    toggle,
    stop,
    isSpeaking,
    isSupported,
    unsupportedReason,
    playbackError,
    activeKey: controllerRef.current.getActiveKey(),
  };
}
