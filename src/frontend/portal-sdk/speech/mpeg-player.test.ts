import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  bumpPlaybackGeneration,
  consumeMpegStream,
  getPlaybackGeneration,
  resetMpegPlayerStateForTests,
  SpeechCancelledError,
  stopMpegPlayback,
} from "./mpeg-player.ts";

const originalAudio = globalThis.Audio;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function createStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

beforeEach(() => {
  resetMpegPlayerStateForTests();
  URL.createObjectURL = mock(() => "blob:mock-audio") as typeof URL.createObjectURL;
  URL.revokeObjectURL = mock(() => {}) as typeof URL.revokeObjectURL;

  globalThis.HTMLMediaElement = {
    HAVE_METADATA: 1,
    HAVE_FUTURE_DATA: 3,
    HAVE_ENOUGH_DATA: 4,
  } as unknown as typeof HTMLMediaElement;

  globalThis.Audio = mock(function MockAudio() {
    const listeners = new Map<string, Array<() => void>>();
    return {
      src: "",
      currentTime: 0,
      readyState: 4,
      error: null,
      setAttribute: mock(() => {}),
      removeAttribute: mock(() => {}),
      pause: mock(() => {}),
      load: mock(function load(this: { readyState: number }) {
        this.readyState = 4;
      }),
      play: mock(function play(this: { emit: (type: string) => void }) {
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
  }) as unknown as typeof Audio;

  globalThis.window = {} as Window & typeof globalThis;
  globalThis.MediaError = { MEDIA_ERR_SRC_NOT_SUPPORTED: 4 } as unknown as typeof MediaError;
});

afterEach(() => {
  resetMpegPlayerStateForTests();
  globalThis.Audio = originalAudio;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe("consumeMpegStream", () => {
  it("缓冲后播放并返回完整音频", async () => {
    const generation = bumpPlaybackGeneration();
    const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00]);

    const { buffer, played } = await consumeMpegStream(createStream([audio]), generation, true);

    expect(buffer.byteLength).toBe(audio.byteLength);
    expect(played).toBe(true);
    expect(getPlaybackGeneration()).toBe(generation);
  });

  it("停止后读取流会抛出 SpeechCancelledError", async () => {
    const generation = bumpPlaybackGeneration();
    const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
    const stream = createStream([audio, audio, audio]);

    stopMpegPlayback();
    await expect(consumeMpegStream(stream, generation, false)).rejects.toBeInstanceOf(
      SpeechCancelledError,
    );
  });

  it("Chromium MSE 支持时边收边播", async () => {
    class MockMediaSource {
      readyState = "open";
      addEventListener(type: string, fn: () => void) {
        if (type === "sourceopen") queueMicrotask(fn);
      }
      removeEventListener() {}
      addSourceBuffer() {
        return {
          appendBuffer: () => {},
          addEventListener: (type: string, fn: () => void) => {
            if (type === "updateend") queueMicrotask(fn);
          },
          removeEventListener: () => {},
          updating: false,
        };
      }
      endOfStream = mock(() => {});
    }

    globalThis.MediaSource = mock(function MockMediaSourceCtor() {
      return new MockMediaSource();
    }) as unknown as typeof MediaSource;
    (
      globalThis.MediaSource as unknown as { isTypeSupported: (mime: string) => boolean }
    ).isTypeSupported = mock(() => true);

    globalThis.Audio = mock(function MockAudio() {
      const listeners = new Map<string, Array<() => void>>();
      return {
        src: "",
        currentTime: 0,
        readyState: 4,
        ended: false,
        error: null,
        setAttribute: mock(() => {}),
        removeAttribute: mock(() => {}),
        pause: mock(() => {}),
        load: mock(() => {}),
        play: mock(function play(this: { ended: boolean; emit: (type: string) => void }) {
          queueMicrotask(() => {
            this.ended = true;
            this.emit("ended");
          });
          return Promise.resolve();
        }),
        addEventListener(type: string, listener: () => void) {
          const list = listeners.get(type) ?? [];
          list.push(listener);
          listeners.set(type, list);
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
    }) as unknown as typeof Audio;

    const generation = bumpPlaybackGeneration();
    const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const { played } = await consumeMpegStream(createStream([audio]), generation, true);
    expect(played).toBe(true);
  });
});
