import { isMobileWebViewSpeechRuntime } from "./mobile-speech-runtime.ts";

/** 极短静音 WAV，在手势链内解锁 HTMLAudio，且不回放上一段朗读 */
export const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const MPEG_PLAYER_STATE_KEY = "freeanimaMpegPlayerState";

type MpegPlayerState = {
  playbackGeneration: number;
  sharedAudio: HTMLAudioElement | null;
  activeObjectUrl: string | null;
  activeMediaSource: MediaSource | null;
};

function playerState(): MpegPlayerState {
  const root = globalThis as typeof globalThis & Record<string, MpegPlayerState | undefined>;
  if (!root[MPEG_PLAYER_STATE_KEY]) {
    root[MPEG_PLAYER_STATE_KEY] = {
      playbackGeneration: 0,
      sharedAudio: null,
      activeObjectUrl: null,
      activeMediaSource: null,
    };
  }
  return root[MPEG_PLAYER_STATE_KEY];
}

export function getPlaybackGeneration(): number {
  return playerState().playbackGeneration;
}

export function bumpPlaybackGeneration(): number {
  const state = playerState();
  state.playbackGeneration += 1;
  return state.playbackGeneration;
}

export function createAudioElement(): HTMLAudioElement {
  const audio = new Audio();
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.preload = "auto";
  return audio;
}

function mediaErrorMessage(audio: HTMLAudioElement): string {
  const code = audio.error?.code;
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "语音播放失败：浏览器不支持 MP3 解码";
  }
  if (code != null) {
    return `语音播放失败（MediaError ${code}）`;
  }
  return "语音播放失败";
}

function resetSharedAudioElement(): void {
  const audio = playerState().sharedAudio;
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  audio.removeAttribute("src");
  audio.src = "";
  audio.load();
}

function revokeActiveObjectUrl(): void {
  const state = playerState();
  if (state.activeObjectUrl) {
    URL.revokeObjectURL(state.activeObjectUrl);
    state.activeObjectUrl = null;
  }
}

function disposeMediaSource(): void {
  const state = playerState();
  if (state.activeMediaSource && state.activeMediaSource.readyState === "open") {
    try {
      state.activeMediaSource.endOfStream();
    } catch {
      /* ignore */
    }
  }
  state.activeMediaSource = null;
}

export function stopMpegPlayback(): void {
  bumpPlaybackGeneration();
  resetSharedAudioElement();
  revokeActiveObjectUrl();
  disposeMediaSource();
}

/** 在用户点击/触摸同步链内调用，解锁移动端 HTMLAudio 播放 */
export function primeMpegSpeechOutput(): void {
  if (typeof window === "undefined") return;
  const state = playerState();
  if (!state.sharedAudio) {
    state.sharedAudio = createAudioElement();
  }
  resetSharedAudioElement();
  state.sharedAudio.src = SILENT_WAV_DATA_URI;
  state.sharedAudio.load();
  void state.sharedAudio.play().catch(() => {
    /* 仅用于手势解锁，失败可忽略 */
  });
}

function isCancelled(generation: number): boolean {
  return generation !== getPlaybackGeneration();
}

function waitForCanPlay(audio: HTMLAudioElement, generation: number): Promise<void> {
  if (isCancelled(generation)) {
    return Promise.reject(new SpeechCancelledError());
  }
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("loadeddata", onReady);
      audio.removeEventListener("error", onError);
      clearTimeout(timer);
    };
    const finish = (fn: () => void) => {
      if (settled || isCancelled(generation)) return;
      settled = true;
      cleanup();
      fn();
    };
    const onReady = () => finish(resolve);
    const onError = () => finish(() => reject(new Error(mediaErrorMessage(audio))));
    const timer = setTimeout(() => {
      if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
        finish(resolve);
      }
    }, 8_000);

    audio.addEventListener("canplaythrough", onReady);
    audio.addEventListener("canplay", onReady);
    audio.addEventListener("loadeddata", onReady);
    audio.addEventListener("error", onError);
  });
}

export class SpeechCancelledError extends Error {
  constructor() {
    super("朗读已取消");
    this.name = "SpeechCancelledError";
  }
}

export function isSpeechCancelledError(err: unknown): boolean {
  return err instanceof SpeechCancelledError;
}

export async function readStreamToArrayBuffer(
  body: ReadableStream<Uint8Array>,
  generation: number,
): Promise<ArrayBuffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      if (isCancelled(generation)) {
        throw new SpeechCancelledError();
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    throw new Error("栖息地未返回音频数据");
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

async function playAudioElementToEnd(audio: HTMLAudioElement, generation: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(mediaErrorMessage(audio)));
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    void audio.play().catch((err: unknown) => {
      cleanup();
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        reject(new Error("语音播放失败：浏览器阻止自动播放，请再次点击试听"));
        return;
      }
      reject(err instanceof Error ? err : new Error("语音播放失败"));
    });
  });

  if (isCancelled(generation)) {
    throw new SpeechCancelledError();
  }
}

function isMpegMseSupported(): boolean {
  // Android WebView：isTypeSupported('audio/mpeg') 偶发 true，但 MSE 播 MP3 实际不可用
  if (isMobileWebViewSpeechRuntime()) return false;
  return (
    typeof MediaSource !== "undefined" &&
    typeof MediaSource.isTypeSupported === "function" &&
    MediaSource.isTypeSupported("audio/mpeg")
  );
}

async function appendSourceBuffer(sourceBuffer: SourceBuffer, chunk: Uint8Array): Promise<void> {
  const bytes = new Uint8Array(chunk);
  await new Promise<void>((resolve, reject) => {
    const onUpdateEnd = () => {
      sourceBuffer.removeEventListener("updateend", onUpdateEnd);
      sourceBuffer.removeEventListener("error", onUpdateError);
      resolve();
    };
    const onUpdateError = () => {
      sourceBuffer.removeEventListener("updateend", onUpdateEnd);
      sourceBuffer.removeEventListener("error", onUpdateError);
      reject(new Error("语音播放失败"));
    };
    sourceBuffer.addEventListener("updateend", onUpdateEnd);
    sourceBuffer.addEventListener("error", onUpdateError);
    try {
      sourceBuffer.appendBuffer(bytes);
    } catch (err) {
      sourceBuffer.removeEventListener("updateend", onUpdateEnd);
      sourceBuffer.removeEventListener("error", onUpdateError);
      reject(err instanceof Error ? err : new Error("语音播放失败"));
    }
  });
}

async function waitForAudioEnded(audio: HTMLAudioElement, generation: number): Promise<void> {
  if (isCancelled(generation)) {
    throw new SpeechCancelledError();
  }
  if (audio.ended) return;

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(mediaErrorMessage(audio)));
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
  });

  if (isCancelled(generation)) {
    throw new SpeechCancelledError();
  }
}

async function playMpegViaMse(
  body: ReadableStream<Uint8Array>,
  generation: number,
): Promise<ArrayBuffer> {
  if (typeof window === "undefined") {
    throw new Error("语音播放需要浏览器环境");
  }

  const state = playerState();
  if (!state.sharedAudio) {
    state.sharedAudio = createAudioElement();
  }

  revokeActiveObjectUrl();
  disposeMediaSource();

  const mediaSource = new MediaSource();
  state.activeMediaSource = mediaSource;
  const objectUrl = URL.createObjectURL(mediaSource);
  state.activeObjectUrl = objectUrl;

  const audio = state.sharedAudio;
  audio.pause();
  audio.currentTime = 0;
  audio.src = objectUrl;

  const collected: Uint8Array[] = [];
  let totalBytes = 0;
  let startedPlayback = false;

  await new Promise<void>((resolve, reject) => {
    const onSourceOpen = () => {
      mediaSource.removeEventListener("sourceopen", onSourceOpen);
      void (async () => {
        let sourceBuffer: SourceBuffer;
        try {
          sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        } catch (err) {
          reject(err instanceof Error ? err : new Error("语音播放失败"));
          return;
        }

        const reader = body.getReader();
        try {
          while (true) {
            if (isCancelled(generation)) {
              throw new SpeechCancelledError();
            }
            const { done, value } = await reader.read();
            if (done) break;
            if (!value || value.byteLength === 0) continue;

            collected.push(value);
            totalBytes += value.byteLength;
            await appendSourceBuffer(sourceBuffer, value);

            if (!startedPlayback && !isCancelled(generation)) {
              startedPlayback = true;
              void audio.play().catch((err: unknown) => {
                if (err instanceof DOMException && err.name === "NotAllowedError") {
                  reject(new Error("语音播放失败：浏览器阻止自动播放，请再次点击试听"));
                  return;
                }
                reject(err instanceof Error ? err : new Error("语音播放失败"));
              });
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (totalBytes === 0) {
          reject(new Error("栖息地未返回音频数据"));
          return;
        }

        if (mediaSource.readyState === "open") {
          mediaSource.endOfStream();
        }

        if (startedPlayback) {
          await waitForAudioEnded(audio, generation);
        } else {
          await waitForCanPlay(audio, generation);
          await playAudioElementToEnd(audio, generation);
        }
        resolve();
      })().catch(reject);
    };

    mediaSource.addEventListener("sourceopen", onSourceOpen);
    audio.addEventListener(
      "error",
      () => {
        reject(new Error(mediaErrorMessage(audio)));
      },
      { once: true },
    );
  });

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of collected) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

export type ConsumeMpegStreamResult = {
  buffer: ArrayBuffer;
  played: boolean;
};

export async function playMpegBuffer(buffer: ArrayBuffer, generation: number): Promise<void> {
  if (isCancelled(generation)) return;
  if (typeof window === "undefined") {
    throw new Error("语音播放需要浏览器环境");
  }

  const state = playerState();
  if (!state.sharedAudio) {
    state.sharedAudio = createAudioElement();
  }

  disposeMediaSource();
  const blob = new Blob([buffer], { type: "audio/mpeg" });
  const objectUrl = URL.createObjectURL(blob);
  revokeActiveObjectUrl();
  state.activeObjectUrl = objectUrl;

  const audio = state.sharedAudio;
  audio.pause();
  audio.currentTime = 0;
  audio.src = objectUrl;
  audio.load();

  await waitForCanPlay(audio, generation);
  if (isCancelled(generation)) return;
  await playAudioElementToEnd(audio, generation);
}

/** 收集 MP3 字节；play=true 时边收边播（Chromium MSE）或回退为缓冲后播放 */
export async function consumeMpegStream(
  body: ReadableStream<Uint8Array>,
  generation: number,
  play: boolean,
): Promise<ConsumeMpegStreamResult> {
  if (isCancelled(generation)) {
    throw new SpeechCancelledError();
  }

  if (play && isMpegMseSupported()) {
    const buffer = await playMpegViaMse(body, generation);
    return { buffer, played: true };
  }

  const buffer = await readStreamToArrayBuffer(body, generation);
  if (play) {
    await playMpegBuffer(buffer, generation);
    return { buffer, played: true };
  }
  return { buffer, played: false };
}

export function resetMpegPlayerStateForTests(): void {
  const root = globalThis as typeof globalThis & Record<string, MpegPlayerState | undefined>;
  delete root[MPEG_PLAYER_STATE_KEY];
}
