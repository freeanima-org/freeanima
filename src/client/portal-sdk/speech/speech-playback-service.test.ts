import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { setCreateSpeechAdapterForTests } from "./create-adapter.ts";
import {
  getSpeechPlaybackSnapshot,
  isSpeechSpeaking,
  resetSpeechPlaybackServiceForTests,
  speechMessageKey,
  speechStreamKey,
  stopSpeechPlayback,
  subscribeSpeechPlayback,
  toggleSpeechPlayback,
} from "./speech-playback-service.ts";

let spoken: string[] = [];
let stopped = 0;
let holdEnd = false;

describe("speech-playback-service", () => {
  beforeEach(() => {
    spoken = [];
    stopped = 0;
    holdEnd = false;
    setCreateSpeechAdapterForTests(() => ({
      isSupported: () => true,
      stop() {
        stopped += 1;
      },
      speak(text: string, _locale: string, onEnd: () => void) {
        spoken.push(text);
        if (holdEnd) return;
        onEnd();
      },
    }));
    resetSpeechPlaybackServiceForTests();
  });

  afterEach(() => {
    resetSpeechPlaybackServiceForTests();
    setCreateSpeechAdapterForTests(null);
    spoken = [];
    stopped = 0;
    holdEnd = false;
  });

  it("speechMessageKey 按会话与下标稳定", () => {
    expect(speechMessageKey("c1", 3)).toBe("c1:3");
  });

  it("speechStreamKey 标识流式自动朗读", () => {
    expect(speechStreamKey("c1")).toBe("c1:stream");
  });

  it("toggle 后 activeKey 在「模拟 unmount」后仍保留", () => {
    holdEnd = true;
    let ticks = 0;
    const unsub = subscribeSpeechPlayback(() => {
      ticks += 1;
    });

    toggleSpeechPlayback("c1:0", "hello", "zh");
    expect(getSpeechPlaybackSnapshot().activeKey).toBe("c1:0");
    expect(isSpeechSpeaking("c1:0")).toBe(true);
    expect(spoken).toEqual(["hello"]);

    // 模拟 Chat unmount：仅取消订阅，不 stop
    unsub();
    expect(getSpeechPlaybackSnapshot().activeKey).toBe("c1:0");
    expect(ticks).toBeGreaterThanOrEqual(1);
  });

  it("stop 清空 activeKey", () => {
    holdEnd = true;
    toggleSpeechPlayback("c1:1", "keep", "zh");
    expect(getSpeechPlaybackSnapshot().activeKey).toBe("c1:1");
    stopSpeechPlayback();
    expect(getSpeechPlaybackSnapshot().activeKey).toBeNull();
    expect(stopped).toBeGreaterThanOrEqual(1);
  });

  it("再次 toggle 同一 key 停止", () => {
    holdEnd = true;
    toggleSpeechPlayback("c1:2", "x", "zh");
    toggleSpeechPlayback("c1:2", "x", "zh");
    expect(getSpeechPlaybackSnapshot().activeKey).toBeNull();
  });
});
