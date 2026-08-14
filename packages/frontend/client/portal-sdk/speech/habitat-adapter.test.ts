import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { DEFAULT_SPEECH_PLAYBACK_CONFIG } from "./types.ts";
import { FIRST_HABITAT_TTS_CHUNK_MAX } from "./constants.ts";
import { setTtsAudioCacheForTests, TtsAudioCache } from "./tts-cache.ts";
import {
  getSharedMpegAudioElement,
  resetMpegPlayerStateForTests,
  SILENT_WAV_DATA_URI,
  stopMpegPlayback,
} from "./mpeg-player.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  createHabitatSpeechAdapter,
  primeHabitatSpeechOutput,
  splitTextForHabitatSpeech,
} from "./habitat-adapter.ts";

const originalFetch = globalThis.fetch;
const originalAudio = globalThis.Audio;
const originalCreateObjectURL = URL.createObjectURL.bind(URL);
const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
const originalMediaSource = globalThis.MediaSource;
const originalHtmlMediaElement = globalThis.HTMLMediaElement;
const originalMediaError = globalThis.MediaError;
const prevWindow = globalThis.window;

let latestMockAudio: ReturnType<typeof createMockAudio> | null = null;

function createMockAudio() {
  const listeners = new Map<string, Array<() => void>>();
  // spy 与方法分离，避免 bun mock 包一层后丢失 this（CI 上 src 赋值/ended 会错绑）
  const pauseSpy = mock(() => {});
  const loadSpy = mock(() => {});
  const playSpy = mock(() => {});
  const removeAttributeSpy = mock((_name: string) => {});
  const audio = {
    src: "",
    preload: "",
    currentTime: 0,
    readyState: 4,
    ended: false,
    error: null as MediaError | null,
    setAttribute: mock(() => {}),
    pauseSpy,
    loadSpy,
    playSpy,
    removeAttributeSpy,
    pause() {
      pauseSpy();
    },
    removeAttribute(name: string) {
      removeAttributeSpy(name);
      if (name === "src") this.src = "";
    },
    load() {
      this.readyState = 4;
      this.ended = false;
      loadSpy();
    },
    play() {
      playSpy();
      queueMicrotask(() => {
        this.ended = true;
        this.emit("ended");
      });
      return Promise.resolve();
    },
    addEventListener(type: string, listener: () => void) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
      if (type === "canplaythrough" || type === "canplay" || type === "loadeddata") {
        queueMicrotask(listener);
      }
    },
    removeEventListener(type: string, listener: () => void) {
      const list = listeners.get(type) ?? [];
      listeners.set(
        type,
        list.filter((item) => item !== listener),
      );
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
  return audio;
}

function streamResponse(buffer: ArrayBuffer): Response {
  return new Response(buffer, {
    status: 200,
    headers: { "content-type": "audio/mpeg" },
  });
}

beforeEach(() => {
  latestMockAudio = null;
  resetMpegPlayerStateForTests();
  setTtsAudioCacheForTests(new TtsAudioCache());
  stopMpegPlayback();
  // 隔离：勿继承其它用例泄漏的 MediaSource mock（否则会误走 MSE 路径挂死）
  // @ts-expect-error test isolation
  globalThis.MediaSource = undefined;
  URL.createObjectURL = mock(() => "blob:mock-audio");
  URL.revokeObjectURL = mock(() => {});

  globalThis.Audio = mock(function MockAudio() {
    latestMockAudio = createMockAudio();
    return latestMockAudio;
  }) as unknown as typeof Audio;

  globalThis.HTMLMediaElement = {
    HAVE_METADATA: 1,
    HAVE_FUTURE_DATA: 3,
    HAVE_ENOUGH_DATA: 4,
  } as unknown as typeof HTMLMediaElement;

  globalThis.window = {
    location: { origin: "http://192.168.1.10:2658", pathname: "/web/chat", port: "2658" },
    portalShell: {
      habitatUrl: "http://192.168.1.10:2658",
      remoteAuth: { token: "secret-token-min-16" },
    },
    MediaError: { MEDIA_ERR_SRC_NOT_SUPPORTED: 4 },
  } as unknown as Window & typeof globalThis;
});

afterEach(() => {
  setTtsAudioCacheForTests(null);
  resetMpegPlayerStateForTests();
  stopMpegPlayback();
  globalThis.fetch = originalFetch;
  globalThis.Audio = originalAudio;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  if (originalMediaSource === undefined) {
    // @ts-expect-error test cleanup
    globalThis.MediaSource = undefined;
  } else {
    globalThis.MediaSource = originalMediaSource;
  }
  if (originalHtmlMediaElement === undefined) {
    // @ts-expect-error test cleanup
    globalThis.HTMLMediaElement = undefined;
  } else {
    globalThis.HTMLMediaElement = originalHtmlMediaElement;
  }
  if (originalMediaError === undefined) {
    // @ts-expect-error test cleanup
    globalThis.MediaError = undefined;
  } else {
    globalThis.MediaError = originalMediaError;
  }
  if (prevWindow === undefined) {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  } else {
    globalThis.window = prevWindow;
  }
});

describe("splitTextForHabitatSpeech", () => {
  it("首段不超过 FIRST_HABITAT_TTS_CHUNK_MAX", () => {
    const long = `${"甲".repeat(80)}。${"乙".repeat(300)}。${"丙".repeat(500)}。`;
    const chunks = splitTextForHabitatSpeech(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.length ?? 0).toBeLessThanOrEqual(FIRST_HABITAT_TTS_CHUNK_MAX);
  });
});

describe("createHabitatSpeechAdapter", () => {
  it("plays synthesized audio from Habitat API stream", async () => {
    const audioBuffer = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]).buffer;

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = coerceString(input);
      expect(url).toBe("http://192.168.1.10:2658/rpc/v1/tts/synthesize");
      return streamResponse(audioBuffer);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createHabitatSpeechAdapter({
      ...DEFAULT_SPEECH_PLAYBACK_CONFIG,
      provider: "edge-tts",
    });

    await new Promise<void>((resolve, reject) => {
      adapter.speak("你好", "zh-CN", resolve, reject);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const audio = getSharedMpegAudioElement() as ReturnType<typeof createMockAudio> | null;
    expect(audio).toBe(latestMockAudio);
    expect(audio?.src).toContain("blob:mock-audio");

    const pauseCalls = audio?.pauseSpy.mock.calls.length ?? 0;
    const loadCalls = audio?.loadSpy.mock.calls.length ?? 0;
    const playCalls = audio?.playSpy.mock.calls.length ?? 0;

    primeHabitatSpeechOutput();

    const shared = getSharedMpegAudioElement() as ReturnType<typeof createMockAudio> | null;
    expect(shared).toBe(audio);
    expect(shared?.src).toBe(SILENT_WAV_DATA_URI);
    expect(shared?.pauseSpy.mock.calls.length).toBeGreaterThan(pauseCalls);
    expect(shared?.loadSpy.mock.calls.length).toBeGreaterThan(loadCalls);
    expect(shared?.playSpy.mock.calls.length).toBeGreaterThan(playCalls);
  });

  it("缓存命中时不重复请求 Habitat", async () => {
    const audioBuffer = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]).buffer;

    const fetchMock = mock(async () => streamResponse(audioBuffer));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createHabitatSpeechAdapter({
      ...DEFAULT_SPEECH_PLAYBACK_CONFIG,
      provider: "edge-tts",
    });

    await new Promise<void>((resolve, reject) => {
      adapter.speak("你好", "zh-CN", resolve, reject);
    });
    await new Promise<void>((resolve, reject) => {
      adapter.speak("你好", "zh-CN", resolve, reject);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prefetch 写入缓存后 speak 不再请求 Habitat", async () => {
    const audioBuffer = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]).buffer;
    const fetchMock = mock(async () => streamResponse(audioBuffer));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createHabitatSpeechAdapter({
      ...DEFAULT_SPEECH_PLAYBACK_CONFIG,
      provider: "edge-tts",
    });

    adapter.prefetch?.("下一句。", "zh-CN");
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 30);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // speak 开头会 bump generation；预取不得被取消
    stopMpegPlayback();

    await new Promise<void>((resolve, reject) => {
      adapter.speak("下一句。", "zh-CN", resolve, reject);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("长文预取：第二段 fetch 在第一段播放完成前启动", async () => {
    const audioBuffer = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]).buffer;

    let releaseFirstPlay: (() => void) | undefined;
    const firstPlayGate = new Promise<void>((resolve) => {
      releaseFirstPlay = resolve;
    });

    globalThis.Audio = mock(function MockAudio() {
      const audio = createMockAudio();
      audio.play = function play(this: typeof audio) {
        audio.playSpy();
        void firstPlayGate.then(() => {
          this.ended = true;
          this.emit("ended");
        });
        return Promise.resolve();
      };
      latestMockAudio = audio;
      return audio;
    }) as unknown as typeof Audio;

    let fetchCount = 0;
    let secondFetchBeforePlayEnd = false;
    const fetchMock = mock(async () => {
      fetchCount += 1;
      if (fetchCount === 2) {
        secondFetchBeforePlayEnd = releaseFirstPlay != null;
      }
      return streamResponse(audioBuffer);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createHabitatSpeechAdapter({
      ...DEFAULT_SPEECH_PLAYBACK_CONFIG,
      provider: "edge-tts",
    });

    const longText = `${"甲".repeat(FIRST_HABITAT_TTS_CHUNK_MAX)}。${"乙".repeat(200)}。`;
    const speakDone = new Promise<void>((resolve, reject) => {
      adapter.speak(longText, "zh-CN", resolve, reject);
    });

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 30);
    });
    expect(secondFetchBeforePlayEnd).toBe(true);
    if (releaseFirstPlay) releaseFirstPlay();
    await speakDone;
    expect(fetchCount).toBeGreaterThanOrEqual(2);
  });
});
