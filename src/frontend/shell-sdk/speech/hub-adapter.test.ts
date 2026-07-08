import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { DEFAULT_SPEECH_PLAYBACK_CONFIG } from "./types.ts";
import { FIRST_HUB_TTS_CHUNK_MAX } from "./constants.ts";
import { setTtsAudioCacheForTests, TtsAudioCache } from "./tts-cache.ts";
import { resetMpegPlayerStateForTests, stopMpegPlayback } from "./mpeg-player.ts";

const originalFetch = globalThis.fetch;
const originalAudio = globalThis.Audio;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const prevWindow = globalThis.window;

let latestMockAudio: ReturnType<typeof createMockAudio> | null = null;

function createMockAudio() {
  const listeners = new Map<string, Array<() => void>>();
  const audio = {
    src: "",
    preload: "",
    currentTime: 0,
    readyState: 4,
    error: null as MediaError | null,
    setAttribute: mock(() => {}),
    pause: mock(function pause(this: { src: string; currentTime: number }) {
      /* noop */
    }),
    removeAttribute: mock(function removeAttribute(this: { src: string }, name: string) {
      if (name === "src") this.src = "";
    }),
    load: mock(function load(this: { readyState: number }) {
      this.readyState = 4;
    }),
    play: mock(function play(this: { emit: (type: string) => void; src: string }) {
      queueMicrotask(() => this.emit("ended"));
      return Promise.resolve();
    }),
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
  URL.createObjectURL = mock(() => "blob:mock-audio") as typeof URL.createObjectURL;
  URL.revokeObjectURL = mock(() => {}) as typeof URL.revokeObjectURL;

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
    satelliteShell: {
      hubUrl: "http://192.168.1.10:2658",
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
  if (prevWindow === undefined) {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  } else {
    globalThis.window = prevWindow;
  }
});

describe("splitTextForHubSpeech", () => {
  it("首段不超过 FIRST_HUB_TTS_CHUNK_MAX", async () => {
    const { splitTextForHubSpeech } = await import("./hub-adapter.ts");
    const long = `${"甲".repeat(80)}。${"乙".repeat(300)}。${"丙".repeat(500)}。`;
    const chunks = splitTextForHubSpeech(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.length ?? 0).toBeLessThanOrEqual(FIRST_HUB_TTS_CHUNK_MAX);
  });
});

describe("createHubSpeechAdapter", () => {
  it("plays synthesized audio from Hub API stream", async () => {
    const { createHubSpeechAdapter } = await import("./hub-adapter.ts");
    const audioBuffer = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]).buffer;

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toBe("http://192.168.1.10:2658/api/tts/synthesize");
      return streamResponse(audioBuffer);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createHubSpeechAdapter({
      ...DEFAULT_SPEECH_PLAYBACK_CONFIG,
      provider: "edge-tts",
    });

    await new Promise<void>((resolve, reject) => {
      adapter.speak("你好", "zh-CN", resolve, reject);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { primeHubSpeechOutput } = await import("./hub-adapter.ts");
    const audio = latestMockAudio;
    expect(audio?.src).toContain("blob:mock-audio");

    primeHubSpeechOutput();

    expect(audio?.pause).toHaveBeenCalled();
    expect(audio?.src).toContain("data:audio/wav");
    expect(audio?.load).toHaveBeenCalled();
    expect(audio?.play).toHaveBeenCalled();
  });

  it("缓存命中时不重复请求 Hub", async () => {
    const { createHubSpeechAdapter } = await import("./hub-adapter.ts");
    const audioBuffer = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]).buffer;

    const fetchMock = mock(async () => streamResponse(audioBuffer));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapter = createHubSpeechAdapter({
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

  it("长文预取：第二段 fetch 在第一段播放完成前启动", async () => {
    const { createHubSpeechAdapter } = await import("./hub-adapter.ts");
    const audioBuffer = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]).buffer;

    let releaseFirstPlay: (() => void) | undefined;
    const firstPlayGate = new Promise<void>((resolve) => {
      releaseFirstPlay = resolve;
    });

    globalThis.Audio = mock(function MockAudio() {
      const audio = createMockAudio();
      audio.play = mock(function play(this: { emit: (type: string) => void }) {
        void firstPlayGate.then(() => this.emit("ended"));
        return Promise.resolve();
      }) as typeof audio.play;
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

    const adapter = createHubSpeechAdapter({
      ...DEFAULT_SPEECH_PLAYBACK_CONFIG,
      provider: "edge-tts",
    });

    const longText = `${"甲".repeat(FIRST_HUB_TTS_CHUNK_MAX)}。${"乙".repeat(200)}。`;
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
