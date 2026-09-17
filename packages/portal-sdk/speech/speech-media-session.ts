/// <reference lib="dom" />
import { getSharedMpegAudioElement } from "./mpeg-player.ts";

function mediaSession(): MediaSession | null {
  if (typeof navigator === "undefined") return null;
  return navigator.mediaSession ?? null;
}

export function syncSpeechMediaSession(activeKey: string | null): void {
  const session = mediaSession();
  if (!session) return;

  if (!activeKey) {
    clearSpeechMediaSession();
    return;
  }

  try {
    session.metadata = new MediaMetadata({
      title: "朗读",
      artist: "FreeAnima",
    });
  } catch {
    /* MediaMetadata 不可用时仍更新 playbackState */
  }

  const audio = getSharedMpegAudioElement();
  const paused = audio?.paused === true;
  session.playbackState = paused ? "paused" : "playing";
}

export function clearSpeechMediaSession(): void {
  const session = mediaSession();
  if (!session) return;
  try {
    session.metadata = null;
  } catch {
    /* ignore */
  }
  session.playbackState = "none";
}

export type SpeechMediaSessionActions = {
  play: () => void;
  pause: () => void;
  stop: () => void;
};

/** 绑定系统媒体控件；可重复调用（后绑覆盖） */
export function bindSpeechMediaSessionActions(actions: SpeechMediaSessionActions): () => void {
  const session = mediaSession();
  if (!session) return () => {};

  try {
    session.setActionHandler("play", () => actions.play());
    session.setActionHandler("pause", () => actions.pause());
    session.setActionHandler("stop", () => actions.stop());
  } catch {
    /* 部分 WebView 不支持全部 action */
  }

  return () => {
    try {
      session.setActionHandler("play", null);
      session.setActionHandler("pause", null);
      session.setActionHandler("stop", null);
    } catch {
      /* ignore */
    }
  };
}
