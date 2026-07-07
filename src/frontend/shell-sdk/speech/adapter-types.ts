export type SpeechPlaybackAdapter = {
  isSupported: () => boolean;
  speak: (text: string, locale: string, onEnd: () => void, onError?: () => void) => void;
  stop: () => void;
};

export type SpeechUnsupportedReason = "disabled" | "no_api" | "insecure_context";
