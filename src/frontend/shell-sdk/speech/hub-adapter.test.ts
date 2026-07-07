import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { DEFAULT_SPEECH_PLAYBACK_CONFIG } from "./types.ts";

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

beforeEach(() => {
  latestMockAudio = null;
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

describe("createHubSpeechAdapter", () => {
  it("plays synthesized audio from Hub API", async () => {
    const { createHubSpeechAdapter } = await import("./hub-adapter.ts");
    const audioBuffer = new Uint8Array([0xff, 0xf3, 0x64, 0xc4]).buffer;

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toBe("http://192.168.1.10:2658/api/tts/synthesize");
      return new Response(audioBuffer, { status: 200 });
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
});
