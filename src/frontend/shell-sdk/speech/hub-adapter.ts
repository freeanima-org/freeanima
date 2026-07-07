import { MAX_HUB_TTS_TEXT_LENGTH } from "./constants.ts";
import type { SpeechPlaybackAdapter } from "./adapter-types.ts";
import { synthesizeSpeechViaHub } from "./tts-api.ts";
import type { SpeechPlaybackConfig } from "./types.ts";
import { splitTextForSpeech } from "./browser-adapter.ts";

const HUB_CHUNK_LEN = MAX_HUB_TTS_TEXT_LENGTH;

/** 极短静音 WAV，在手势链内解锁 HTMLAudio，且不回放上一段朗读 */
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

let lastPlaybackErrorMessage: string | undefined;

export function consumeLastHubSpeechError(): string | undefined {
  const message = lastPlaybackErrorMessage;
  lastPlaybackErrorMessage = undefined;
  return message;
}

/** 在用户点击/触摸同步链内调用，解锁移动端 HTMLAudio 播放 */
export function primeHubSpeechOutput(): void {
  if (typeof window === "undefined") return;
  if (!sharedAudio) {
    sharedAudio = createAudioElement();
  }
  resetSharedAudioElement();
  sharedAudio.src = SILENT_WAV_DATA_URI;
  sharedAudio.load();
  void sharedAudio.play().catch(() => {
    /* 仅用于手势解锁，失败可忽略 */
  });
}

function createAudioElement(): HTMLAudioElement {
  const audio = new Audio();
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  audio.preload = "auto";
  return audio;
}

function splitTextForHubSpeech(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= HUB_CHUNK_LEN) return [normalized];

  const coarse = splitTextForSpeech(normalized);
  const chunks: string[] = [];
  let current = "";

  for (const part of coarse) {
    if (current.length + part.length > HUB_CHUNK_LEN) {
      if (current.trim()) chunks.push(current.trim());
      if (part.length > HUB_CHUNK_LEN) {
        for (let i = 0; i < part.length; i += HUB_CHUNK_LEN) {
          chunks.push(part.slice(i, i + HUB_CHUNK_LEN).trim());
        }
        current = "";
      } else {
        current = part;
      }
    } else {
      current += part;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [normalized.slice(0, HUB_CHUNK_LEN)];
}

let playbackGeneration = 0;
let sharedAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;

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
  if (!sharedAudio) return;
  sharedAudio.pause();
  sharedAudio.currentTime = 0;
  sharedAudio.removeAttribute("src");
  sharedAudio.src = "";
  sharedAudio.load();
}

function stopActiveAudio(): void {
  playbackGeneration += 1;
  resetSharedAudioElement();
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function waitForCanPlay(audio: HTMLAudioElement, generation: number): Promise<void> {
  if (generation !== playbackGeneration) {
    return Promise.reject(new Error("朗读已取消"));
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
      if (settled || generation !== playbackGeneration) return;
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

async function playMpegBuffer(buffer: ArrayBuffer, generation: number): Promise<void> {
  if (generation !== playbackGeneration) return;
  if (typeof window === "undefined") {
    throw new Error("语音播放需要浏览器环境");
  }

  if (!sharedAudio) {
    sharedAudio = createAudioElement();
  }

  const blob = new Blob([buffer], { type: "audio/mpeg" });
  const objectUrl = URL.createObjectURL(blob);
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
  }
  activeObjectUrl = objectUrl;

  const audio = sharedAudio;
  audio.pause();
  audio.currentTime = 0;
  audio.src = objectUrl;
  audio.load();

  await waitForCanPlay(audio, generation);
  if (generation !== playbackGeneration) return;

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
}

export function createHubSpeechAdapter(speechOptions: SpeechPlaybackConfig): SpeechPlaybackAdapter {
  const options = speechOptions;

  return {
    isSupported: () => options.enabled && options.provider === "edge-tts",

    stop() {
      stopActiveAudio();
    },

    speak(text, locale, onEnd, onError) {
      if (!options.enabled || options.provider !== "edge-tts") {
        lastPlaybackErrorMessage = "朗读未启用";
        onError?.();
        return;
      }

      const chunks = splitTextForHubSpeech(text);
      if (chunks.length === 0) {
        onEnd();
        return;
      }

      stopActiveAudio();
      primeHubSpeechOutput();
      const generation = playbackGeneration;

      void (async () => {
        try {
          for (const chunk of chunks) {
            if (generation !== playbackGeneration) return;

            const buffer = await synthesizeSpeechViaHub({
              text: chunk,
              lang: options.lang,
              voice: options.voiceName,
              appLocale: locale,
              rate: options.rate,
              pitch: options.pitch,
              volume: options.volume,
            });

            if (generation !== playbackGeneration) return;
            await playMpegBuffer(buffer, generation);
          }

          if (generation === playbackGeneration) onEnd();
        } catch (err) {
          if (generation !== playbackGeneration) return;
          lastPlaybackErrorMessage = err instanceof Error ? err.message : String(err);
          onError?.();
        }
      })();
    },
  };
}
