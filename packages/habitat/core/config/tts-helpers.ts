import {
  DEFAULT_TTS_PITCH,
  DEFAULT_TTS_PREVIEW_TEXT,
  DEFAULT_TTS_PROVIDER,
  DEFAULT_TTS_RATE,
  DEFAULT_TTS_VOLUME,
  type ResolvedSpeechConfig,
  type TtsProvider,
} from "./schemas/tts.ts";
import { DEFAULT_EDGE_TTS_BASE_URL, VOICE_PROTOCOL_EDGE_TTS } from "./schemas/llm-config.ts";
import type { RuntimeConfig } from "./schemas/runtime-config.ts";
import { resolveScene } from "./llm-config.ts";
import { effectiveProviderModalities } from "../llm/presets.ts";

export type { ResolvedSpeechConfig };

export type ResolvedEdgeTtsConnection = {
  baseUrl: string;
  /** 场景 model 可作默认 voice ShortName */
  voiceHint: string | null;
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

function parseProvider(raw: unknown): TtsProvider {
  if (raw === "web-speech") return "web-speech";
  return DEFAULT_TTS_PROVIDER;
}

/**
 * 从 audio_generate.tts（可继承 main）+ 连接 audio_protocol=edge-tts 解析 Edge 连接。
 */
export function resolveEdgeTtsConnection(cfg: RuntimeConfig): ResolvedEdgeTtsConnection | null {
  let scene: ReturnType<typeof resolveScene>;
  try {
    scene = resolveScene(cfg, "tts");
  } catch {
    return null;
  }
  const voiceProtocol = effectiveProviderModalities(scene.provider).audio_protocol;
  if (voiceProtocol != null && voiceProtocol !== VOICE_PROTOCOL_EDGE_TTS) {
    return null;
  }
  const baseUrl = (scene.provider.base_url?.trim() || DEFAULT_EDGE_TTS_BASE_URL).replace(/\/$/, "");
  const voiceHint = scene.model?.trim() || null;
  return { baseUrl, voiceHint };
}

export function getResolvedSpeechConfig(cfg: RuntimeConfig): ResolvedSpeechConfig {
  const tts = cfg.tts ?? {};
  const lang = tts.lang?.trim() || null;
  const voiceName = tts.voice_name?.trim() || null;
  const preview = tts.preview_text?.trim() || DEFAULT_TTS_PREVIEW_TEXT;
  const edge = resolveEdgeTtsConnection(cfg);

  // 显式 web-speech → 客户端；否则走栖息地场景（edge / openai / alibaba）
  let provider = parseProvider(tts.provider);
  if (tts.provider === "web-speech") {
    provider = "web-speech";
  } else if (edge || tts.provider === "edge-tts") {
    provider = "edge-tts";
  } else {
    // 前端用 edge-tts 表示「走 Habitat RPC」；实际协议由 audio_generate 决定
    provider = "edge-tts";
  }

  let sceneVoice: string | null = null;
  try {
    const voiceScene = resolveScene(cfg, "tts");
    sceneVoice =
      typeof voiceScene.params?.voice === "string" ? voiceScene.params.voice.trim() : null;
  } catch {
    sceneVoice = null;
  }

  return {
    enabled: tts.enabled !== false,
    provider,
    lang,
    voiceName: voiceName || sceneVoice || edge?.voiceHint || null,
    preferLocal: tts.prefer_local !== false,
    rate: clampRate(tts.rate),
    pitch: clampPitch(tts.pitch),
    volume: clampVolume(tts.volume),
    previewText: preview,
  };
}

export function isSpeechPlaybackEnabled(cfg: RuntimeConfig): boolean {
  return getResolvedSpeechConfig(cfg).enabled;
}

/**
 * Edge 合成用的 HTTP proxy：仅当 base_url 不像默认微软 TTS 根时传入库的 proxy。
 * （库无自定义 service endpoint；反代场景把 base_url 当 proxy。）
 */
export function edgeTtsProxyFromBaseUrl(baseUrl: string | null | undefined): string | undefined {
  const trimmed = baseUrl?.trim().replace(/\/$/, "");
  if (!trimmed) return undefined;
  const def = DEFAULT_EDGE_TTS_BASE_URL.replace(/\/$/, "");
  if (trimmed === def || trimmed.startsWith("https://api.msedgeservices.com")) {
    return undefined;
  }
  return trimmed;
}
