import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { getAppLocale } from "@chat/lib/i18n.ts";
import { createBrowserSpeechAdapter } from "@chat/lib/speech/browser-adapter.ts";
import { createSpeechPlaybackController } from "@chat/lib/speech/controller.ts";
import type { SpeechPlaybackAdapter } from "@chat/lib/speech/types.ts";

export function useSpeechPlayback(adapter?: SpeechPlaybackAdapter) {
  const speechAdapter = useMemo(() => adapter ?? createBrowserSpeechAdapter(), [adapter]);
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
