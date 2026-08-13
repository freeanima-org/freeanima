import {
  FIRST_HABITAT_TTS_CHUNK_MAX,
  LATER_HABITAT_TTS_CHUNK_MAX,
  LATER_HABITAT_TTS_CHUNK_MIN,
  MIN_HABITAT_TTS_SPLIT_LEN,
  SECOND_HABITAT_TTS_CHUNK_MAX,
  SECOND_HABITAT_TTS_CHUNK_MIN,
} from "./constants.ts";
import type { SpeechPlaybackAdapter } from "./adapter-types.ts";
import { prefetchHabitatTtsToCache, synthesizeSpeechViaHubStream } from "./tts-api.ts";
import type { SpeechPlaybackConfig } from "./types.ts";
import {
  getPlaybackGeneration,
  isSpeechCancelledError,
  playMpegBuffer,
  primeMpegSpeechOutput,
  stopMpegPlayback,
} from "./mpeg-player.ts";

let lastPlaybackErrorMessage: string | undefined;

export function consumeLastHubSpeechError(): string | undefined {
  const message = lastPlaybackErrorMessage;
  lastPlaybackErrorMessage = undefined;
  return message;
}

/** 在用户点击/触摸同步链内调用，解锁移动端 HTMLAudio 播放 */
export function primeHabitatSpeechOutput(): void {
  primeMpegSpeechOutput();
}

type ChunkTier = { min: number; max: number };

function chunkTier(index: number): ChunkTier {
  if (index === 0) return { min: 1, max: FIRST_HABITAT_TTS_CHUNK_MAX };
  if (index === 1) return { min: SECOND_HABITAT_TTS_CHUNK_MIN, max: SECOND_HABITAT_TTS_CHUNK_MAX };
  return { min: LATER_HABITAT_TTS_CHUNK_MIN, max: LATER_HABITAT_TTS_CHUNK_MAX };
}

function findCutIndex(text: string, tier: ChunkTier, preferEarly: boolean): number {
  if (text.length <= tier.max) return text.length;

  const sentenceEnd = /[。！？.!?]/g;
  let match: RegExpExecArray | null;
  let firstEnd = -1;
  let bestEnd = -1;

  while ((match = sentenceEnd.exec(text)) !== null) {
    const end = match.index + 1;
    if (end > tier.max) break;
    if (firstEnd < 0) firstEnd = end;
    if (end >= tier.min) bestEnd = end;
  }

  if (preferEarly && firstEnd > 0) return firstEnd;
  if (bestEnd > 0) return bestEnd;
  if (firstEnd > 0 && tier.min <= 1) return firstEnd;
  return tier.max;
}

function takeTierChunk(remaining: string, tier: ChunkTier, preferEarly: boolean): string {
  const trimmed = remaining.trimStart();
  if (!trimmed) return "";

  // 未超本段上限则整段保留；仅长文本才按句读/上限切开（首段 preferEarly 缩短首音延迟）
  if (trimmed.length <= tier.max) return trimmed;

  const cut = findCutIndex(trimmed, tier, preferEarly);
  return trimmed.slice(0, cut).trim();
}

export function splitTextForHabitatSpeech(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= MIN_HABITAT_TTS_SPLIT_LEN) return [normalized];

  const chunks: string[] = [];
  let cursor = 0;
  let tierIndex = 0;

  while (cursor < normalized.length) {
    const raw = normalized.slice(cursor);
    const remaining = raw.trimStart();
    const skipped = raw.length - remaining.length;
    if (!remaining) break;

    const tier = chunkTier(tierIndex);
    const chunk = takeTierChunk(remaining, tier, tierIndex === 0);
    if (!chunk) break;

    chunks.push(chunk);
    cursor += skipped + chunk.length;
    tierIndex += 1;
  }

  return chunks.length > 0 ? chunks : [normalized];
}

export function createHabitatSpeechAdapter(
  speechOptions: SpeechPlaybackConfig,
): SpeechPlaybackAdapter {
  const options = speechOptions;

  return {
    isSupported: () => options.enabled && options.provider === "edge-tts",

    stop() {
      stopMpegPlayback();
    },

    prefetch(text, locale) {
      if (!options.enabled || options.provider !== "edge-tts") return;
      const chunks = splitTextForHabitatSpeech(text);
      const first = chunks[0];
      if (!first) return;
      void prefetchHabitatTtsToCache({
        text: first,
        lang: options.lang,
        voice: options.voiceName,
        appLocale: locale,
        rate: options.rate,
        pitch: options.pitch,
        volume: options.volume,
      }).catch(() => {
        /* 预取失败不影响当前播放；下一句 speak 会再请求 */
      });
    },

    speak(text, locale, onEnd, onError) {
      if (!options.enabled || options.provider !== "edge-tts") {
        lastPlaybackErrorMessage = "朗读未启用";
        onError?.();
        return;
      }

      const chunks = splitTextForHabitatSpeech(text);
      if (chunks.length === 0) {
        onEnd();
        return;
      }

      stopMpegPlayback();
      primeHabitatSpeechOutput();
      const generation = getPlaybackGeneration();

      void (async () => {
        try {
          const synthParams = {
            lang: options.lang,
            voice: options.voiceName,
            appLocale: locale,
            rate: options.rate,
            pitch: options.pitch,
            volume: options.volume,
          };

          const startFetch = (chunkText: string, play: boolean, onResponse?: () => void) =>
            synthesizeSpeechViaHubStream(
              { ...synthParams, text: chunkText },
              onResponse ? { generation, play, onResponse } : { generation, play },
            );

          let upcoming: ReturnType<typeof startFetch> | null = null;
          let current: ReturnType<typeof startFetch> | null = chunks[0]
            ? startFetch(chunks[0], true, () => {
                const second = chunks[1];
                if (second) upcoming = startFetch(second, false);
              })
            : null;

          for (let i = 0; i < chunks.length; i++) {
            if (generation !== getPlaybackGeneration()) return;
            if (!current) break;

            const result = await current;
            current = null;

            if (generation !== getPlaybackGeneration()) return;

            if (!result.played) {
              await playMpegBuffer(result.buffer, generation);
            }

            if (i + 1 >= chunks.length) break;

            if (upcoming) {
              current = upcoming;
              upcoming = null;
              const lookahead = chunks[i + 2];
              if (lookahead) {
                upcoming = startFetch(lookahead, false);
              }
            } else {
              const nextChunk = chunks[i + 1];
              if (nextChunk) current = startFetch(nextChunk, false);
            }
          }

          if (generation === getPlaybackGeneration()) onEnd();
        } catch (err) {
          if (generation !== getPlaybackGeneration() || isSpeechCancelledError(err)) return;
          lastPlaybackErrorMessage = err instanceof Error ? err.message : String(err);
          onError?.();
        }
      })();
    },
  };
}
