import {
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_FORMAT_OPENAI_RESPONSES,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_IDS,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_OPENROUTER,
  EMBEDDINGS_PROTOCOL_OPENAI,
  EMBEDDINGS_PROTOCOL_IDS,
  IMAGE_PROTOCOL_OPENAI,
  IMAGE_PROTOCOL_ALIBABA_MULTIMODAL,
  IMAGE_PROTOCOL_IDS,
  AUDIO_PROTOCOL_ALIBABA_AUDIO,
  AUDIO_PROTOCOL_IDS,
  type AudioProtocolId,
  type EmbeddingsProtocolId,
  type ImageProtocolId,
  type LlmFormatId,
  type LlmPresetId,
  type ConnectionConfig,
} from "@freeanima/habitat/core/config/schemas/llm-config";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { ProviderSpec } from "@freeanima/habitat/core/provider";

/** 阿里云 Token Plan · OpenAI 兼容根 */
export const ALIBABA_TOKEN_PLAN_OPENAI_BASE_URL =
  "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

/**
 * 阿里云 Token Plan · Anthropic Messages 根（与 OpenAI 兼容根不同 host，须另建连接）。
 * 仅文档/提示用，不作为本预设的 defaultBaseUrl。
 */
export const ALIBABA_TOKEN_PLAN_ANTHROPIC_BASE_URL =
  "https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic";

/** 预设声明的各模态协议（null = 该预设不支持） */
export type PresetModalitySuite = {
  text: LlmFormatId | "gateway";
  image: ImageProtocolId | null;
  embeddings: EmbeddingsProtocolId | null;
  audio: AudioProtocolId | null;
  video: string | null;
};

export type SingleFormatPreset = {
  kind: "single";
  id: Exclude<LlmPresetId, "custom">;
  format: LlmFormatId;
  defaultBaseUrl: string;
  modalities: PresetModalitySuite;
};

export type GatewayFormatPreset = {
  kind: "gateway";
  id: typeof LLM_PRESET_OPENCODE_GO;
  defaultBaseUrl: string;
  /** Catalog / fallback format when model is unknown */
  defaultFormat: LlmFormatId;
  resolveFormat: (model: string) => LlmFormatId;
  modalities: PresetModalitySuite;
};

export type LlmPresetDef = SingleFormatPreset | GatewayFormatPreset;

const OPENCODE_GO_RESPONSES_MODELS = new Set(["gpt-5.6-luna"]);

const OPENCODE_GO_ANTHROPIC_MODELS = new Set([
  "minimax-m3",
  "minimax-m2.7",
  "minimax-m2.5",
  "qwen3.8-max",
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.6-plus",
]);

export function resolveOpencodeGoFormat(model: string): LlmFormatId {
  const id = model.trim().toLowerCase();
  const bare = id.includes("/") ? (id.split("/").pop() ?? id) : id;
  if (OPENCODE_GO_RESPONSES_MODELS.has(bare)) return LLM_FORMAT_OPENAI_RESPONSES;
  if (OPENCODE_GO_ANTHROPIC_MODELS.has(bare)) return LLM_FORMAT_ANTHROPIC_MESSAGES;
  return LLM_FORMAT_OPENAI_COMPATIBLE;
}

export const LLM_PRESETS: Record<Exclude<LlmPresetId, "custom">, LlmPresetDef> = {
  [LLM_PRESET_DEEPSEEK]: {
    kind: "single",
    id: LLM_PRESET_DEEPSEEK,
    format: LLM_FORMAT_OPENAI_COMPATIBLE,
    defaultBaseUrl: "https://api.deepseek.com",
    modalities: {
      text: LLM_FORMAT_OPENAI_COMPATIBLE,
      image: null,
      embeddings: null,
      audio: null,
      video: null,
    },
  },
  [LLM_PRESET_OPENROUTER]: {
    kind: "single",
    id: LLM_PRESET_OPENROUTER,
    format: LLM_FORMAT_OPENAI_COMPATIBLE,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    modalities: {
      text: LLM_FORMAT_OPENAI_COMPATIBLE,
      image: IMAGE_PROTOCOL_OPENAI,
      embeddings: EMBEDDINGS_PROTOCOL_OPENAI,
      audio: null,
      video: null,
    },
  },
  [LLM_PRESET_OPENCODE_GO]: {
    kind: "gateway",
    id: LLM_PRESET_OPENCODE_GO,
    defaultBaseUrl: "https://opencode.ai/zen/go/v1",
    defaultFormat: LLM_FORMAT_OPENAI_COMPATIBLE,
    resolveFormat: resolveOpencodeGoFormat,
    modalities: {
      text: "gateway",
      image: null,
      embeddings: null,
      audio: null,
      video: null,
    },
  },
  [LLM_PRESET_ALIBABA_TOKEN_PLAN]: {
    kind: "single",
    id: LLM_PRESET_ALIBABA_TOKEN_PLAN,
    format: LLM_FORMAT_OPENAI_COMPATIBLE,
    defaultBaseUrl: ALIBABA_TOKEN_PLAN_OPENAI_BASE_URL,
    modalities: {
      text: LLM_FORMAT_OPENAI_COMPATIBLE,
      image: IMAGE_PROTOCOL_ALIBABA_MULTIMODAL,
      embeddings: null,
      audio: AUDIO_PROTOCOL_ALIBABA_AUDIO,
      video: null,
    },
  },
};

export function getLlmPreset(id: LlmPresetId): LlmPresetDef | null {
  if (id === LLM_PRESET_CUSTOM) return null;
  return LLM_PRESETS[id];
}

export function presetModalityFields(presetId: LlmPresetId): Partial<{
  text_protocol: LlmFormatId;
  image_protocol: ImageProtocolId | null;
  embeddings_protocol: EmbeddingsProtocolId | null;
  audio_protocol: AudioProtocolId | null;
  video_protocol: string | null;
}> {
  const def = getLlmPreset(presetId);
  if (!def) return {};
  const text = def.kind === "gateway" ? def.defaultFormat : def.format;
  return {
    text_protocol: text,
    image_protocol: def.modalities.image,
    embeddings_protocol: def.modalities.embeddings,
    audio_protocol: def.modalities.audio,
    video_protocol: def.modalities.video,
  };
}

function pickKnownId<T extends string>(
  raw: string | null | undefined,
  ids: readonly T[],
): T | null {
  if (raw == null || raw === "") return null;
  for (const id of ids) {
    if (id === raw) return id;
  }
  return null;
}

export function connectionHasTextCapability(cfg: {
  preset?: string | undefined;
  custom_kind?: string | undefined;
  text_protocol?: string | undefined;
}): boolean {
  const presetId = pickKnownId(cfg.preset, LLM_PRESET_IDS);
  if (presetId != null && presetId !== LLM_PRESET_CUSTOM) return true;
  if (cfg.custom_kind === "text") return true;
  return cfg.custom_kind == null && Boolean(cfg.text_protocol);
}

export function effectiveTextProtocol(cfg: ConnectionConfig): LlmFormatId | undefined {
  const presetId = pickKnownId(cfg.preset, LLM_PRESET_IDS);
  if (presetId != null && presetId !== LLM_PRESET_CUSTOM) {
    const def = LLM_PRESETS[presetId];
    return def.kind === "gateway" ? def.defaultFormat : def.format;
  }
  return cfg.text_protocol;
}

/** 连接是否覆盖某能力层（内置看套件；自定义看 custom_kind） */
export function connectionSupportsLayer(
  cfg: {
    preset?: string | undefined;
    custom_kind?: string | undefined;
    text_protocol?: string | undefined;
    image_protocol?: string | null | undefined;
    embeddings_protocol?: string | null | undefined;
    audio_protocol?: string | null | undefined;
    voice_protocol?: string | null | undefined;
    video_protocol?: string | null | undefined;
  },
  layer: "text" | "image" | "audio" | "video" | "embeddings",
): boolean {
  const presetId = pickKnownId(cfg.preset, LLM_PRESET_IDS);
  if (presetId != null && presetId !== LLM_PRESET_CUSTOM) {
    if (layer === "text") return true;
    const modalities = effectiveProviderModalities(cfg);
    if (layer === "image") return modalities.image_protocol != null;
    if (layer === "audio") return modalities.audio_protocol != null;
    if (layer === "embeddings") return modalities.embeddings_protocol != null;
    return modalities.video_protocol != null;
  }
  return cfg.custom_kind === layer;
}

/**
 * 连接上生效的模态协议。
 * 内置预设以预设声明为准；自定义读连接自身字段。
 */
export function effectiveProviderModalities(cfg: {
  preset?: string | undefined;
  custom_kind?: string | undefined;
  image_protocol?: string | null | undefined;
  embeddings_protocol?: string | null | undefined;
  audio_protocol?: string | null | undefined;
  voice_protocol?: string | null | undefined;
  video_protocol?: string | null | undefined;
}): {
  image_protocol: ImageProtocolId | null;
  embeddings_protocol: EmbeddingsProtocolId | null;
  audio_protocol: AudioProtocolId | null;
  voice_protocol: AudioProtocolId | null;
  video_protocol: string | null;
} {
  const presetId = pickKnownId(cfg.preset, LLM_PRESET_IDS);
  if (presetId != null && presetId !== LLM_PRESET_CUSTOM) {
    const fields = presetModalityFields(presetId);
    const audio = fields.audio_protocol ?? null;
    return {
      image_protocol: fields.image_protocol ?? null,
      embeddings_protocol: fields.embeddings_protocol ?? null,
      audio_protocol: audio,
      voice_protocol: audio,
      video_protocol: fields.video_protocol ?? null,
    };
  }
  const audio = pickKnownId(cfg.audio_protocol ?? cfg.voice_protocol, AUDIO_PROTOCOL_IDS);
  const video =
    typeof cfg.video_protocol === "string" && cfg.video_protocol.trim()
      ? cfg.video_protocol.trim()
      : null;
  return {
    image_protocol: pickKnownId(cfg.image_protocol, IMAGE_PROTOCOL_IDS),
    embeddings_protocol: pickKnownId(cfg.embeddings_protocol, EMBEDDINGS_PROTOCOL_IDS),
    audio_protocol: audio,
    voice_protocol: audio,
    video_protocol: video,
  };
}

export function connectionEndpointUrl(cfg: ConnectionConfig): string {
  const presetId = cfg.preset ?? LLM_PRESET_CUSTOM;
  if (presetId !== LLM_PRESET_CUSTOM) {
    return LLM_PRESETS[presetId].defaultBaseUrl.replace(/\/$/, "");
  }
  const baseUrl = cfg.base_url?.replace(/\/$/, "");
  if (baseUrl == null || !baseUrl) {
    throw new Error("custom connection requires base_url");
  }
  return baseUrl;
}

export type MaterializedConnection = {
  formatId: LlmFormatId;
  baseUrl: string;
  resolveFormat?: (model: string) => LlmFormatId;
};

/** Resolve preset + config into format/baseUrl (+ optional per-model format). */
export function materializeConnection(cfg: ConnectionConfig): MaterializedConnection {
  const presetId = cfg.preset ?? LLM_PRESET_CUSTOM;
  const textFormat = cfg.text_protocol;
  if (presetId === LLM_PRESET_CUSTOM) {
    const baseUrl = cfg.base_url?.replace(/\/$/, "");
    if (baseUrl == null || !baseUrl) {
      throw new Error("custom connection requires base_url");
    }
    if (cfg.custom_kind === "text" || (cfg.custom_kind == null && textFormat != null)) {
      if (textFormat == null) {
        throw new Error("custom text connection requires text_protocol");
      }
      return { formatId: textFormat, baseUrl };
    }
    throw new Error("materializeConnection is for text-capable connections");
  }

  const presetDef = LLM_PRESETS[presetId];
  const baseUrl = presetDef.defaultBaseUrl.replace(/\/$/, "");

  if (presetDef.kind === "single") {
    return {
      formatId: textFormat ?? presetDef.format,
      baseUrl,
    };
  }

  return {
    formatId: textFormat ?? presetDef.defaultFormat,
    baseUrl,
    resolveFormat: presetDef.resolveFormat,
  };
}

export function providerConfigToSpec(id: string, cfg: ConnectionConfig): ProviderSpec {
  if (!cfg.api_key?.trim()) {
    throw new Error(`connections.${id}.api_key is required`);
  }
  const materialized = materializeConnection(cfg);
  return omitUndefined({
    id,
    backendId: materialized.formatId,
    context: omitUndefined({
      baseUrl: materialized.baseUrl,
      apiKey: cfg.api_key,
      timeoutMs: cfg.timeout_ms,
      connectTimeoutMs: cfg.connect_timeout_ms,
      firstByteTimeoutMs: cfg.first_byte_timeout_ms,
      idleTimeoutMs: cfg.idle_timeout_ms,
    }),
    resolveFormat: materialized.resolveFormat,
  });
}
