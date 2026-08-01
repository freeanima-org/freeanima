import { describe, expect, it } from "bun:test";
import { createSpeechPlaybackController } from "./controller.ts";
import type { SpeechPlaybackAdapter } from "./adapter-types.ts";

function createMockAdapter(): SpeechPlaybackAdapter & {
  spoken: Array<{ text: string; locale: string }>;
  stopped: number;
  finishCurrent: () => void;
} {
  const spoken: Array<{ text: string; locale: string }> = [];
  let stopped = 0;
  let pendingEnd: (() => void) | null = null;

  return {
    spoken,
    get stopped() {
      return stopped;
    },
    finishCurrent() {
      const end = pendingEnd;
      pendingEnd = null;
      end?.();
    },
    isSupported: () => true,
    stop() {
      stopped += 1;
      pendingEnd = null;
    },
    speak(text, locale, end) {
      spoken.push({ text, locale });
      pendingEnd = end;
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
    expect(ctrl.getActiveKey()).toBe("msg-1");
    expect(ctrl.isSpeaking("msg-1")).toBe(true);
    adapter.finishCurrent();
    expect(ctrl.getActiveKey()).toBeNull();
    expect(version).toBeGreaterThanOrEqual(2);
    expect(adapter.spoken).toEqual([{ text: "hello", locale: "en" }]);
  });

  it("再次 toggle 同一 key 会 stop", () => {
    const adapter = createMockAdapter();
    const ctrl = createSpeechPlaybackController(adapter, () => {});
    ctrl.toggle("msg-1", "hello", "en");
    expect(ctrl.isSpeaking("msg-1")).toBe(true);
    ctrl.toggle("msg-1", "hello", "en");
    expect(adapter.stopped).toBeGreaterThanOrEqual(1);
    expect(ctrl.getActiveKey()).toBeNull();
  });

  it("切换 key 时停止前一条再播新条", () => {
    const adapter = createMockAdapter();
    const ctrl = createSpeechPlaybackController(adapter, () => {});
    ctrl.toggle("msg-1", "one", "en");
    ctrl.toggle("msg-2", "two", "en");
    expect(adapter.stopped).toBeGreaterThanOrEqual(1);
    expect(adapter.spoken.map((s) => s.text)).toEqual(["one", "two"]);
    expect(ctrl.getActiveKey()).toBe("msg-2");
  });

  it("空文本不触发 speak", () => {
    const adapter = createMockAdapter();
    const ctrl = createSpeechPlaybackController(adapter, () => {});
    ctrl.toggle("msg-1", "   ", "en");
    expect(adapter.spoken).toHaveLength(0);
    expect(ctrl.getActiveKey()).toBeNull();
  });

  it("enqueue FIFO 顺序播放", () => {
    const adapter = createMockAdapter();
    const ctrl = createSpeechPlaybackController(adapter, () => {});
    ctrl.enqueue("stream", "一。", "zh-cn");
    ctrl.enqueue("stream", "二。", "zh-cn");
    ctrl.enqueue("stream", "三。", "zh-cn");
    expect(adapter.spoken).toEqual([{ text: "一。", locale: "zh-cn" }]);
    adapter.finishCurrent();
    expect(adapter.spoken.map((s) => s.text)).toEqual(["一。", "二。"]);
    adapter.finishCurrent();
    expect(adapter.spoken.map((s) => s.text)).toEqual(["一。", "二。", "三。"]);
    adapter.finishCurrent();
    expect(ctrl.getActiveKey()).toBeNull();
  });

  it("stop 清空队列且旧 onEnd 不再继续", () => {
    const adapter = createMockAdapter();
    const ctrl = createSpeechPlaybackController(adapter, () => {});
    ctrl.enqueue("stream", "一。", "zh-cn");
    ctrl.enqueue("stream", "二。", "zh-cn");
    ctrl.stop();
    expect(ctrl.getActiveKey()).toBeNull();
    adapter.finishCurrent();
    expect(adapter.spoken).toHaveLength(1);
  });

  it("toggle 会清空待播队列", () => {
    const adapter = createMockAdapter();
    const ctrl = createSpeechPlaybackController(adapter, () => {});
    ctrl.enqueue("stream", "一。", "zh-cn");
    ctrl.enqueue("stream", "二。", "zh-cn");
    ctrl.toggle("msg-9", "整条", "en");
    expect(adapter.spoken.map((s) => s.text)).toEqual(["一。", "整条"]);
    adapter.finishCurrent();
    expect(ctrl.getActiveKey()).toBeNull();
    expect(adapter.spoken.map((s) => s.text)).toEqual(["一。", "整条"]);
  });
});
