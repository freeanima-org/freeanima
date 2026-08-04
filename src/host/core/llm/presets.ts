import {
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_FORMAT_OPENAI_RESPONSES,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_OPENROUTER,
  type LlmFormatId,
  type LlmPresetId,
  type LlmProviderConfig,
} from "@freeanima/host/core/config/schemas/llm-config";
import { omitUndefined } from "@freeanima/host/core/util";
import type { ProviderSpec } from "@freeanima/host/core/provider";

export type SingleFormatPreset = {
  kind: "single";
  id: Exclude<LlmPresetId, "custom">;
  format: LlmFormatId;
  defaultBaseUrl: string;
};

export type GatewayFormatPreset = {
  kind: "gateway";
  id: typeof LLM_PRESET_OPENCODE_GO;
  defaultBaseUrl: string;
  /** Catalog / fallback format when model is unknown */
  defaultFormat: LlmFormatId;
  resolveFormat: (model: string) => LlmFormatId;
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
  },
  [LLM_PRESET_OPENROUTER]: {
    kind: "single",
    id: LLM_PRESET_OPENROUTER,
    format: LLM_FORMAT_OPENAI_COMPATIBLE,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
  [LLM_PRESET_OPENCODE_GO]: {
    kind: "gateway",
    id: LLM_PRESET_OPENCODE_GO,
    defaultBaseUrl: "https://opencode.ai/zen/go/v1",
    defaultFormat: LLM_FORMAT_OPENAI_COMPATIBLE,
    resolveFormat: resolveOpencodeGoFormat,
  },
};

export function getLlmPreset(id: LlmPresetId): LlmPresetDef | null {
  if (id === LLM_PRESET_CUSTOM) return null;
  return LLM_PRESETS[id];
}

export type MaterializedConnection = {
  formatId: LlmFormatId;
  baseUrl: string;
  resolveFormat?: (model: string) => LlmFormatId;
};

/** Resolve preset + config into format/baseUrl (+ optional per-model format). */
export function materializeConnection(cfg: LlmProviderConfig): MaterializedConnection {
  const presetId = cfg.preset ?? LLM_PRESET_CUSTOM;
  if (presetId === LLM_PRESET_CUSTOM) {
    if (cfg.format == null || cfg.base_url == null) {
      throw new Error("custom connection requires format and base_url");
    }
    return {
      formatId: cfg.format,
      baseUrl: cfg.base_url.replace(/\/$/, ""),
    };
  }

  const presetDef = LLM_PRESETS[presetId];
  const baseUrl = (cfg.base_url ?? presetDef.defaultBaseUrl).replace(/\/$/, "");

  if (presetDef.kind === "single") {
    return {
      formatId: cfg.format ?? presetDef.format,
      baseUrl,
    };
  }

  return {
    formatId: cfg.format ?? presetDef.defaultFormat,
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
