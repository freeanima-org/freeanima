import { useEffect } from "react";
import {
  ensureSpeechPlaybackConfig,
  pauseSpeechPlaybackAudio,
  resumeSpeechPlaybackIfNeeded,
  stopSpeechPlayback,
} from "@freeanima/client/portal-sdk/speech/speech-playback-service";
import { bindSpeechMediaSessionActions } from "@freeanima/client/portal-sdk/speech/speech-media-session";

/** Shell 级：拉 TTS 配置、MediaSession、回前台恢复播放（切模块不 stop） */
export function SpeechShellWatcher() {
  useEffect(() => {
    void ensureSpeechPlaybackConfig();
  }, []);

  useEffect(() => {
    return bindSpeechMediaSessionActions({
      play: () => resumeSpeechPlaybackIfNeeded(),
      pause: () => pauseSpeechPlaybackAudio(),
      stop: () => stopSpeechPlayback(),
    });
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      resumeSpeechPlaybackIfNeeded();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return null;
}
