import { describe, expect, it } from "bun:test";
import { createSpeechPlaybackController } from "./controller.ts";
import type { SpeechPlaybackAdapter } from "./adapter-types.ts";

function createMockAdapter(): SpeechPlaybackAdapter & {
  spoken: Array<{ text: string; locale: string }>;
  stopped: number;
} {
  const spoken: Array<{ text: string; locale: string }> = [];
  let stopped = 0;

  return {
    spoken,
    get stopped() {
      return stopped;
    },
    isSupported: () => true,
    stop() {
      stopped += 1;
    },
    speak(text, locale, end) {
      spoken.push({ text, locale });
      end();
    },
  };
}

describe("createSpeechPlaybackController", () => {
  it("toggle 设置 activeKey 并在结束时清空", () => {
    let version = 0;
    const adapter = createMockAdapter();
    const ctrl = createSpeechPlaybackController(adapter, () => {
      version += 1;
    });

    ctrl.toggle("msg-1", "hello", "en");
    expect(ctrl.getActiveKey()).toBeNull();
    expect(version).toBe(2);
    expect(adapter.spoken).toEqual([{ text: "hello", locale: "en" }]);
  });

  it("再次 toggle 同一 key 会 stop", () => {
    let stopped = 0;
    const adapter: SpeechPlaybackAdapter = {
      isSupported: () => true,
      stop() {
        stopped += 1;
      },
      speak(text, _locale, _end) {
        void text;
      },
    };
    const ctrl = createSpeechPlaybackController(adapter, () => {});
    ctrl.toggle("msg-1", "hello", "en");
    expect(ctrl.isSpeaking("msg-1")).toBe(true);
    ctrl.toggle("msg-1", "hello", "en");
    expect(stopped).toBeGreaterThanOrEqual(1);
    expect(ctrl.getActiveKey()).toBeNull();
  });

  it("切换 key 时由 adapter.speak 自行停止前一条", () => {
    const adapter = createMockAdapter();
    const ctrl = createSpeechPlaybackController(adapter, () => {});
    ctrl.toggle("msg-1", "one", "en");
    ctrl.toggle("msg-2", "two", "en");
    expect(adapter.stopped).toBe(0);
  });

  it("空文本不触发 speak", () => {
    const adapter = createMockAdapter();
    const ctrl = createSpeechPlaybackController(adapter, () => {});
    ctrl.toggle("msg-1", "   ", "en");
    expect(adapter.spoken).toHaveLength(0);
    expect(ctrl.getActiveKey()).toBeNull();
  });
});
