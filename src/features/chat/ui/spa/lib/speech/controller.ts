import type { SpeechPlaybackAdapter } from "./types.ts";

export type SpeechPlaybackController = {
  getActiveKey: () => string | null;
  toggle: (key: string, text: string, locale: string) => void;
  stop: () => void;
  isSpeaking: (key: string) => boolean;
  isSupported: () => boolean;
};

export function createSpeechPlaybackController(
  adapter: SpeechPlaybackAdapter,
  onChange: () => void,
): SpeechPlaybackController {
  let activeKey: string | null = null;

  const notify = () => onChange();

  return {
    getActiveKey: () => activeKey,

    isSupported: () => adapter.isSupported(),

    isSpeaking: (key) => activeKey === key,

    stop() {
      if (!activeKey) return;
      adapter.stop();
      activeKey = null;
      notify();
    },

    toggle(key, text, locale) {
      if (activeKey === key) {
        adapter.stop();
        activeKey = null;
        notify();
        return;
      }

      const trimmed = text.trim();
      if (!trimmed || !adapter.isSupported()) return;

      activeKey = key;
      notify();
      adapter.speak(
        trimmed,
        locale,
        () => {
          if (activeKey === key) {
            activeKey = null;
            notify();
          }
        },
        () => {
          if (activeKey === key) {
            activeKey = null;
            notify();
          }
        },
      );
    },
  };
}
