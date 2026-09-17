import { isRecord } from "@freeanima/shared/util";

export const DEFAULT_TTS_RATE = 1;
export const DEFAULT_TTS_PITCH = 1;
export const DEFAULT_TTS_VOLUME = 1;
export const DEFAULT_TTS_PREVIEW_TEXT = "你好，我是逸灵风。";

export const TTS_PROVIDERS = ["edge-tts", "web-speech"] as const;
export type TtsProvider = (typeof TTS_PROVIDERS)[number];
export const DEFAULT_TTS_PROVIDER: TtsProvider = "edge-tts";

/** 客户端朗读参数（由 Habitat tts 段解析） */
export type SpeechPlaybackConfig = {
  enabled: boolean;
  provider: TtsProvider;
  lang: string | null;
  voiceName: string | null;
  preferLocal: boolean;
  rate: number;
  pitch: number;
  volume: number;
  previewText: string;
};

export type SpeechConfigDraft = {
  enabled: boolean;
  provider: TtsProvider;
  lang: string;
  voice_name: string;
  prefer_local: boolean;
  rate: number;
  pitch: number;
  volume: number;
  preview_text: string;
};

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

export function isTtsProvider(value: unknown): value is TtsProvider {
  return typeof value === "string" && (TTS_PROVIDERS as readonly string[]).includes(value);
}

function parseProvider(raw: unknown): TtsProvider {
  return isTtsProvider(raw) ? raw : DEFAULT_TTS_PROVIDER;
}

export function parseSpeechConfigFromHub(tts: unknown): SpeechPlaybackConfig {
  const raw = isRecord(tts) ? tts : {};
  const lang = typeof raw.lang === "string" ? raw.lang.trim() : "";
  const voiceName = typeof raw.voice_name === "string" ? raw.voice_name.trim() : "";
  const preview =
    typeof raw.preview_text === "string" && raw.preview_text.trim()
      ? raw.preview_text.trim()
      : DEFAULT_TTS_PREVIEW_TEXT;

  return {
    enabled: raw.enabled !== false,
    provider: parseProvider(raw.provider),
    lang: lang || null,
    voiceName: voiceName || null,
    preferLocal: raw.prefer_local !== false,
    rate: clampRate(typeof raw.rate === "number" ? raw.rate : undefined),
    pitch: clampPitch(typeof raw.pitch === "number" ? raw.pitch : undefined),
    volume: clampVolume(typeof raw.volume === "number" ? raw.volume : undefined),
    previewText: preview,
  };
}

export function readSpeechConfigDraft(tts: unknown): SpeechConfigDraft {
  const parsed = parseSpeechConfigFromHub(tts);
  return {
    enabled: parsed.enabled,
    provider: parsed.provider,
    lang: parsed.lang ?? "",
    voice_name: parsed.voiceName ?? "",
    prefer_local: parsed.preferLocal,
    rate: parsed.rate,
    pitch: parsed.pitch,
    volume: parsed.volume,
    preview_text: parsed.previewText,
  };
}

export function speechConfigDraftToPatch(draft: SpeechConfigDraft): Record<string, unknown> {
  return {
    enabled: draft.enabled,
    provider: draft.provider,
    lang: draft.lang.trim() || undefined,
    voice_name: draft.voice_name.trim() || undefined,
    prefer_local: draft.prefer_local,
    rate: draft.rate,
    pitch: draft.pitch,
    volume: draft.volume,
    preview_text: draft.preview_text.trim() || DEFAULT_TTS_PREVIEW_TEXT,
  };
}

export const DEFAULT_SPEECH_PLAYBACK_CONFIG = parseSpeechConfigFromHub({});
