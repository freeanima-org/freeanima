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
/** 朗读 locale 固定中文（UI 已内联，无运行时 locale 切换） */
const SPEECH_LOCALE = "zh-CN";

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
    toggleSpeechPlayback(key, text, SPEECH_LOCALE);
  }, []);

  const enqueue = useCallback((key: string, text: string) => {
    enqueueSpeechPlayback(key, text, SPEECH_LOCALE);
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
