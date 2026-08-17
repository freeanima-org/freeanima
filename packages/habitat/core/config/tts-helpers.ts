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
import { materializeLlmScenes, tryGetLlmConfig } from "./llm-config.ts";

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
 * 从 llm.scenes.tts（可继承 voice_generate）+ 连接 voice_protocol=edge-tts 解析 Edge 连接。
 * 未配置时返回 null（合成仍可用库默认端点）。
 */
export function resolveEdgeTtsConnection(cfg: RuntimeConfig): ResolvedEdgeTtsConnection | null {
  const llm = tryGetLlmConfig(cfg);
  if (!llm) return null;
  const scenes = materializeLlmScenes(llm);
  const scene = scenes.tts ?? scenes.voice_generate;
  if (!scene?.connection) return null;
  const provider = llm.providers[scene.connection];
  if (!provider) return null;
  if (provider.voice_protocol != null && provider.voice_protocol !== VOICE_PROTOCOL_EDGE_TTS) {
    return null;
  }
  const baseUrl = (provider.base_url?.trim() || DEFAULT_EDGE_TTS_BASE_URL).replace(/\/$/, "");
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
    // 非 edge 的 Habitat 协议仍标为 edge-tts 枚举以外？ResolvedSpeechConfig.provider 仅 edge|web-speech
    // 前端用 edge-tts 表示「走 Habitat RPC」；实际协议由 scenes.tts 决定
    provider = "edge-tts";
  }

  const llm = tryGetLlmConfig(cfg);
  const scenes = llm ? materializeLlmScenes(llm) : null;
  const voiceScene = scenes?.tts ?? scenes?.voice_generate;
  const sceneVoice =
    typeof voiceScene?.params?.voice === "string" ? voiceScene.params.voice.trim() : null;

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
