export type SpeechPlaybackAdapter = {
  isSupported: () => boolean;
  speak: (text: string, locale: string, onEnd: () => void, onError?: () => void) => void;
  stop: () => void;
  /** 预合成入缓存；播当前句时对队首调用，避免句间干等。可选。 */
  prefetch?: (text: string, locale: string) => void;
};

export type SpeechUnsupportedReason = "disabled" | "no_api" | "insecure_context";
