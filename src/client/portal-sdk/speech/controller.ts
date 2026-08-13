import type { SpeechPlaybackAdapter } from "./adapter-types.ts";

type QueueItem = {
  key: string;
  text: string;
  locale: string;
};

export type SpeechPlaybackController = {
  getActiveKey: () => string | null;
  toggle: (key: string, text: string, locale: string) => void;
  enqueue: (key: string, text: string, locale: string) => void;
  stop: () => void;
  isSpeaking: (key: string) => boolean;
  isSupported: () => boolean;
};

export function createSpeechPlaybackController(
  adapter: SpeechPlaybackAdapter,
  onChange: () => void,
): SpeechPlaybackController {
  let activeKey: string | null = null;
  let playing = false;
  let queue: QueueItem[] = [];
  /** 防止 stop 后旧 speak 的 onEnd 继续 drain */
  let generation = 0;

  const notify = () => onChange();

  const clearQueue = () => {
    queue = [];
  };

  const prefetchHead = () => {
    const head = queue[0];
    if (!head) return;
    adapter.prefetch?.(head.text, head.locale);
  };

  const playNext = (expectedGeneration: number) => {
    if (expectedGeneration !== generation) return;

    const next = queue.shift();
    if (!next) {
      playing = false;
      activeKey = null;
      notify();
      return;
    }

    playing = true;
    activeKey = next.key;
    notify();
    prefetchHead();

    const itemKey = next.key;
    const gen = expectedGeneration;
    adapter.speak(
      next.text,
      next.locale,
      () => {
        if (gen !== generation) return;
        if (activeKey !== itemKey) return;
        playNext(gen);
      },
      () => {
        if (gen !== generation) return;
        if (activeKey !== itemKey) return;
        playNext(gen);
      },
    );
  };

  return {
    getActiveKey: () => activeKey,

    isSupported: () => adapter.isSupported(),

    isSpeaking: (key) => playing && activeKey === key,

    stop() {
      generation += 1;
      clearQueue();
      if (playing || activeKey) adapter.stop();
      playing = false;
      activeKey = null;
      notify();
    },

    enqueue(key, text, locale) {
      const trimmed = text.trim();
      if (!trimmed || !adapter.isSupported()) return;

      queue.push({ key, text: trimmed, locale });
      if (!playing) playNext(generation);
      else {
        prefetchHead();
        notify();
      }
    },

    toggle(key, text, locale) {
      if (playing && activeKey === key) {
        generation += 1;
        clearQueue();
        adapter.stop();
        playing = false;
        activeKey = null;
        notify();
        return;
      }

      const trimmed = text.trim();
      if (!trimmed || !adapter.isSupported()) return;

      generation += 1;
      clearQueue();
      if (playing) adapter.stop();
      playing = false;
      activeKey = null;

      queue.push({ key, text: trimmed, locale });
      playNext(generation);
    },
  };
}
