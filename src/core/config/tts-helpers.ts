import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_PREVIEW_TEXT,
  DEFAULT_TTS_PROVIDER,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOLUME,
  type ResolvedSpeechConfig,
  type TtsProvider,
} from "./schemas/tts.ts";
import type { AnimaConfig } from "./schemas/config.ts";

export type { ResolvedSpeechConfig };

function clampRate(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TTS_RATE;
  return Math.min(10, Math.max(0.1, value));
}

function clampPitch(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TTS_PITCH;
  return Math.min(2, Math.max(0, value));
}

function clampVolume(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TTS_VOLUME;
  return Math.min(1, Math.max(0, value));
}

function parseProvider(raw: unknown): TtsProvider {
  if (raw === "web-speech") return "web-speech";
  return DEFAULT_TTS_PROVIDER;
}

export function getResolvedSpeechConfig(cfg: AnimaConfig): ResolvedSpeechConfig {
  const tts = cfg.tts ?? {};
  const lang = tts.lang?.trim() || null;
  const voiceName = tts.voice_name?.trim() || null;
  const preview = tts.preview_text?.trim() || DEFAULT_TTS_PREVIEW_TEXT;

  return {
    enabled: tts.enabled !== false,
    provider: parseProvider(tts.provider),
    lang,
    voiceName,
    preferLocal: tts.prefer_local !== false,
    rate: clampRate(tts.rate),
    pitch: clampPitch(tts.pitch),
    volume: clampVolume(tts.volume),
    previewText: preview,
  };
}

export function isSpeechPlaybackEnabled(cfg: AnimaConfig): boolean {
  return getResolvedSpeechConfig(cfg).enabled;
}
