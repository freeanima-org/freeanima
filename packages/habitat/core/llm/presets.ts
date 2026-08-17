import {
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_FORMAT_OPENAI_RESPONSES,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_OPENROUTER,
  EMBEDDINGS_PROTOCOL_OPENAI,
  IMAGE_PROTOCOL_OPENAI,
  IMAGE_PROTOCOL_ALIBABA_MULTIMODAL,
  type EmbeddingsProtocolId,
  type ImageProtocolId,
  type LlmFormatId,
  type LlmPresetId,
  type LlmProviderConfig,
  type VoiceProtocolId,
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
  voice: VoiceProtocolId | null;
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

/**
 * OpenCode Go model → format routing.
 * Source: https://opencode.ai/docs/zh-cn/go#api-端点
 * Unknown models default to openai_compatible (with warn via caller).
 */
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
      voice: null,
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
      voice: null,
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
      voice: null,
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
      voice: null,
    },
  },
};

export function getLlmPreset(id: LlmPresetId): LlmPresetDef | null {
  if (id === LLM_PRESET_CUSTOM) return null;
  return LLM_PRESETS[id];
}

/** 非自定义预设的模态协议写入连接字段 */
export function presetModalityFields(presetId: LlmPresetId): Partial<{
  format: LlmFormatId;
  text_protocol: LlmFormatId;
  image_protocol: ImageProtocolId | null;
  embeddings_protocol: EmbeddingsProtocolId | null;
  voice_protocol: VoiceProtocolId | null;
}> {
  const def = getLlmPreset(presetId);
  if (!def) return {};
  const text = def.kind === "gateway" ? def.defaultFormat : def.format;
  return {
    format: text,
    text_protocol: text,
    image_protocol: def.modalities.image,
    embeddings_protocol: def.modalities.embeddings,
    voice_protocol: def.modalities.voice,
  };
}

export type MaterializedConnection = {
  formatId: LlmFormatId;
  baseUrl: string;
  resolveFormat?: (model: string) => LlmFormatId;
};

/** Resolve preset + config into format/baseUrl (+ optional per-model format). */
export function materializeConnection(cfg: LlmProviderConfig): MaterializedConnection {
  const presetId = cfg.preset ?? LLM_PRESET_CUSTOM;
  const textFormat = cfg.format ?? cfg.text_protocol;
  if (presetId === LLM_PRESET_CUSTOM) {
    if (textFormat == null || cfg.base_url == null) {
      throw new Error("custom connection requires text_protocol/format and base_url");
    }
    return {
      formatId: textFormat,
      baseUrl: cfg.base_url.replace(/\/$/, ""),
    };
  }

  const presetDef = LLM_PRESETS[presetId];
  // 内置预设固定 API 根；反代/自建请用「自定义」
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

export function providerConfigToSpec(id: string, cfg: LlmProviderConfig): ProviderSpec {
  if (!cfg.api_key?.trim()) {
    throw new Error(`llm.providers.${id}.api_key is required`);
  }
  const materialized = materializeConnection(cfg);
  return omitUndefined({
    id,
    backendId: materialized.formatId,
    context: omitUndefined({
      baseUrl: materialized.baseUrl,
      apiKey: cfg.api_key,
      timeoutMs: cfg.timeout_ms,
      firstByteTimeoutMs: cfg.first_byte_timeout_ms,
      idleTimeoutMs: cfg.idle_timeout_ms,
    }),
    resolveFormat: materialized.resolveFormat,
  });
}
