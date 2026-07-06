export type SpeechPlaybackStatus = "idle" | "playing";

export type SpeechPlaybackAdapter = {
  isSupported: () => boolean;
  speak: (text: string, locale: string, onEnd: () => void, onError?: () => void) => void;
  stop: () => void;
};
