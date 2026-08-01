import { useCallback, useEffect, useReducer } from "react";
import {
  enqueueSpeechPlayback,
  ensureSpeechPlaybackConfig,
  getSpeechPlaybackSnapshot,
  isSpeechSpeaking,
  stopSpeechPlayback,
  subscribeSpeechPlayback,
  toggleSpeechPlayback,
} from "@freeanima/client/portal-sdk/speech/speech-playback-service";
import { getAppLocale } from "@freeanima/features/chat/ui/spa/lib/i18n.ts";

/**
 * Chat 侧朗读 Hook：订阅 Shell 级单例。
 * 切模块 unmount 时不 stop，以便后台继续播放。
 */
export function useSpeechPlayback() {
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => subscribeSpeechPlayback(() => rerender()), []);

  useEffect(() => {
    void ensureSpeechPlaybackConfig();
  }, []);

  const stop = useCallback(() => {
    stopSpeechPlayback();
  }, []);

  const toggle = useCallback((key: string, text: string) => {
    toggleSpeechPlayback(key, text, getAppLocale());
  }, []);

  const enqueue = useCallback((key: string, text: string) => {
    enqueueSpeechPlayback(key, text, getAppLocale());
  }, []);

  const isSpeaking = useCallback((key: string) => isSpeechSpeaking(key), []);

  const snapshot = getSpeechPlaybackSnapshot();

  return {
    toggle,
    enqueue,
    stop,
    isSpeaking,
    isSupported: snapshot.isSupported,
    unsupportedReason: snapshot.unsupportedReason,
    playbackError: snapshot.playbackError,
    activeKey: snapshot.activeKey,
  };
}
