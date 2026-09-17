/**
 * 厂商无关的语音合成参数（对齐 temperature-tier：产品层中性 → 按协议映射）。
 */

import { asRecord, isRecord } from "@freeanima/shared/util";
import { mapProsodyToEdgeStrings } from "./edge-synthesize.ts";

export type VoiceAudioFormat = "mp3" | "wav" | "pcm";

/** 存 scenes.*.params / tool 覆盖；UI 不暴露厂商字段名 */
export type VoiceProsodyParams = {
  voice?: string;
  /** 相对语速，1.0 = 默认；产品区间约 0.5–2 */
  rate?: number;
  /** 相对音高，1.0 = 默认 */
  pitch?: number;
  /** 相对音量，1.0 = 默认 */
  volume?: number;
  format?: VoiceAudioFormat;
  language?: string;
  /** 情感 / 指令等；仅映射到支持的协议 */
  style?: string;
  extra?: Record<string, unknown>;
};

const DEFAULT_RATE = 1;
const DEFAULT_PITCH = 1;
const DEFAULT_VOLUME = 1;

function asFiniteNumber(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  return raw;
}

function asNonEmptyString(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/** 从场景 params / 扁平对象读取中性参数 */
export function readVoiceProsodyParams(raw: unknown): VoiceProsodyParams {
  if (!isRecord(raw)) return {};
  const o = raw;
  const formatRaw = asNonEmptyString(o.format);
  const format: VoiceAudioFormat | undefined =
    formatRaw === "mp3" || formatRaw === "wav" || formatRaw === "pcm" ? formatRaw : undefined;
  const extra = asRecord(o.extra) ?? undefined;
  const out: VoiceProsodyParams = {};
  const voice = asNonEmptyString(o.voice);
  if (voice) out.voice = voice;
  const rate = asFiniteNumber(o.rate);
  if (rate != null) out.rate = rate;
  const pitch = asFiniteNumber(o.pitch);
  if (pitch != null) out.pitch = pitch;
  const volume = asFiniteNumber(o.volume);
  if (volume != null) out.volume = volume;
  if (format) out.format = format;
  const language = asNonEmptyString(o.language);
  if (language) out.language = language;
  const style = asNonEmptyString(o.style);
  if (style) out.style = style;
  if (extra) out.extra = extra;
  return out;
}

/** 后者覆盖前者（tool / 请求覆盖场景） */
export function mergeVoiceProsodyParams(
  base: VoiceProsodyParams,
  override?: VoiceProsodyParams | null,
): VoiceProsodyParams {
  if (!override) return { ...base };
  const next: VoiceProsodyParams = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || value === null) continue;
    if (key === "extra" && typeof value === "object" && !Array.isArray(value)) {
      next.extra = { ...base.extra, ...value };
      continue;
    }
    Reflect.set(next, key, value);
  }
  return next;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type EdgeMappedProsody = {
  voice?: string;
  rate: number;
  pitch: number;
  volume: number;
  edgeStrings: ReturnType<typeof mapProsodyToEdgeStrings>;
};

export function mapVoiceProsodyToEdge(params: VoiceProsodyParams): EdgeMappedProsody {
  const rate = clamp(params.rate ?? DEFAULT_RATE, 0.1, 10);
  const pitch = clamp(params.pitch ?? DEFAULT_PITCH, 0, 2);
  const volume = clamp(params.volume ?? DEFAULT_VOLUME, 0, 1);
  return {
    ...(params.voice ? { voice: params.voice } : {}),
    rate,
    pitch,
    volume,
    edgeStrings: mapProsodyToEdgeStrings(rate, pitch, volume),
  };
}

export type OpenAiSpeechMapped = {
  voice?: string;
  /** OpenAI speed 约 0.25–4.0 */
  speed: number;
  response_format: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
};

export function mapVoiceProsodyToOpenAiSpeech(params: VoiceProsodyParams): OpenAiSpeechMapped {
  const rate = params.rate ?? DEFAULT_RATE;
  const speed = clamp(rate, 0.25, 4);
  const format =
    params.format === "wav" || params.format === "pcm" ? params.format : ("mp3" as const);
  return {
    ...(params.voice ? { voice: params.voice } : {}),
    speed,
    response_format: format,
  };
}

/** 阿里 DashScope SpeechSynthesizer parameters（rate/pitch 相对 1；volume 0–100） */
export type AlibabaTtsMapped = {
  voice?: string;
  rate: number;
  pitch: number;
  volume: number;
  format: "mp3" | "wav" | "pcm";
  sample_rate: number;
};

export function mapVoiceProsodyToAlibabaTts(params: VoiceProsodyParams): AlibabaTtsMapped {
  const rate = clamp(params.rate ?? DEFAULT_RATE, 0.5, 2);
  const pitch = clamp(params.pitch ?? DEFAULT_PITCH, 0.5, 2);
  const volRel = clamp(params.volume ?? DEFAULT_VOLUME, 0, 1);
  const volume = Math.round(volRel * 100);
  const format = params.format === "wav" || params.format === "pcm" ? params.format : "mp3";
  return {
    ...(params.voice ? { voice: params.voice } : {}),
    rate,
    pitch,
    volume,
    format,
    sample_rate: 22050,
  };
}
