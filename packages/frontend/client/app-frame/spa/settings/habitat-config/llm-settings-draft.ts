import {
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_OPENROUTER,
  LLM_FORMAT_OPENAI_RESPONSES,
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  normalizeLlmProviderRaw,
} from "@freeanima/habitat/core/config";
import { getLlmPreset } from "@freeanima/habitat/core/llm/presets";
import { readHabitatConfigRecord } from "./habitat-config-field-helpers.tsx";
import { coerceString } from "@freeanima/shared/coerce-string";

export function providersDraftToPatch(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const entries = readHabitatConfigRecord(draft);
  const out: Record<string, unknown> = {};
  for (const [id, provider] of Object.entries(entries)) {
    const normalized = normalizeLlmProviderRaw(provider) as Record<string, unknown>;
    out[id] = normalized;
  }
  return out;
}

/** 载入草稿时写好默认 preset/format，避免「看起来已配置、保存却没带上」 */
export function readProvidersDraft(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return providersDraftToPatch(draft);
}

export const LLM_SETTINGS_PRESETS = [
  { id: LLM_PRESET_DEEPSEEK, label: "DeepSeek", hint: "单格式 · Chat Completions" },
  { id: LLM_PRESET_OPENROUTER, label: "OpenRouter", hint: "单格式 · Chat Completions" },
  {
    id: LLM_PRESET_OPENCODE_GO,
    label: "OpenCode Go",
    hint: "多格式网关 · 按模型自动选协议",
  },
  { id: LLM_PRESET_CUSTOM, label: "自定义", hint: "自行指定格式与 Base URL" },
] as const;

export const LLM_SETTINGS_FORMATS = [
  { id: LLM_FORMAT_OPENAI_COMPATIBLE, label: "Chat Completions", code: "openai_compatible" },
  { id: LLM_FORMAT_OPENAI_RESPONSES, label: "Responses", code: "openai_responses" },
  { id: LLM_FORMAT_ANTHROPIC_MESSAGES, label: "Messages", code: "anthropic_messages" },
] as const;

export function llmPresetLabel(presetId: string): string {
  return LLM_SETTINGS_PRESETS.find((p) => p.id === presetId)?.label ?? presetId;
}

export function llmFormatLabel(formatId: string): string {
  const hit = LLM_SETTINGS_FORMATS.find((f) => f.id === formatId);
  return hit ? `${hit.label}（${hit.code}）` : formatId;
}

/** 列表副文：预设名 + URL（空则「使用预设默认」） */
export function connectionListSubtitle(entry: Record<string, unknown>): string {
  const preset = coerceString(entry.preset ?? LLM_PRESET_CUSTOM);
  const label = llmPresetLabel(preset);
  const base = typeof entry.base_url === "string" ? entry.base_url.trim() : "";
  if (base) return `${label} · ${base}`;
  if (preset === LLM_PRESET_CUSTOM) return `${label} · 未填 Base URL`;
  const def = getLlmPreset(preset as typeof LLM_PRESET_DEEPSEEK);
  const defaultUrl = def?.defaultBaseUrl;
  return defaultUrl ? `${label} · 使用预设默认` : label;
}

export function connectionDefaultBaseUrl(presetId: string): string | null {
  if (presetId === LLM_PRESET_CUSTOM) return null;
  const def = getLlmPreset(presetId as typeof LLM_PRESET_DEEPSEEK);
  return def?.defaultBaseUrl ?? null;
}

export type TimeoutDraft = {
  timeout_ms: number | "";
  first_byte_timeout_ms: number | "";
  idle_timeout_ms: number | "";
};

export function readTimeoutDraft(entry: Record<string, unknown>): TimeoutDraft {
  return {
    timeout_ms: typeof entry.timeout_ms === "number" ? entry.timeout_ms : "",
    first_byte_timeout_ms:
      typeof entry.first_byte_timeout_ms === "number" ? entry.first_byte_timeout_ms : "",
    idle_timeout_ms: typeof entry.idle_timeout_ms === "number" ? entry.idle_timeout_ms : "",
  };
}

/** 首字节 / idle 须 ≤ overall；空值跳过 */
export function validateTimeoutDraft(draft: TimeoutDraft): string | null {
  const overall = draft.timeout_ms;
  if (overall === "") return null;
  if (
    draft.first_byte_timeout_ms !== "" &&
    typeof draft.first_byte_timeout_ms === "number" &&
    draft.first_byte_timeout_ms > overall
  ) {
    return "首字节超时须 ≤ 整体超时";
  }
  if (
    draft.idle_timeout_ms !== "" &&
    typeof draft.idle_timeout_ms === "number" &&
    draft.idle_timeout_ms > overall
  ) {
    return "空闲超时须 ≤ 整体超时";
  }
  return null;
}

export function emptyConnectionEntry(): Record<string, unknown> {
  return {
    preset: LLM_PRESET_CUSTOM,
    format: LLM_FORMAT_OPENAI_COMPATIBLE,
  };
}

export function emptySceneEntry(): Record<string, unknown> {
  return {
    chain: [{ provider: "", model: "" }],
  };
}

export type RouteHop = {
  provider: string;
  model: string;
  params?: Record<string, unknown> | undefined;
};

export function readChain(raw: unknown): RouteHop[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const hop = item as Record<string, unknown>;
      const params =
        hop.params && typeof hop.params === "object" && !Array.isArray(hop.params)
          ? (hop.params as Record<string, unknown>)
          : undefined;
      return {
        provider: typeof hop.provider === "string" ? hop.provider : "",
        model: typeof hop.model === "string" ? hop.model : "",
        ...(params ? { params } : {}),
      };
    });
}

export function normalizeHop(hop: RouteHop): RouteHop {
  const provider = hop.provider.trim();
  const model = hop.model.trim();
  const params = hop.params && Object.keys(hop.params).length > 0 ? hop.params : undefined;
  return {
    provider,
    model,
    ...(params ? { params } : {}),
  };
}

export type CallParamsDraft = {
  temperature: number | "";
  topP: number | "";
  maxOutputTokens: number | "";
  stop: string;
  /** 仅回写保留；UI 不编辑 */
  preservedExtra?: Record<string, unknown>;
};

export function emptyCallParamsDraft(): CallParamsDraft {
  return {
    temperature: "",
    topP: "",
    maxOutputTokens: "",
    stop: "",
  };
}

export function readCallParamsDraft(raw: unknown): CallParamsDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyCallParamsDraft();
  const params = raw as Record<string, unknown>;
  const stop = params.stop;
  let stopText = "";
  if (typeof stop === "string") stopText = stop;
  else if (Array.isArray(stop)) stopText = stop.map(String).join("\n");

  const preservedExtra =
    params.extra && typeof params.extra === "object" && !Array.isArray(params.extra)
      ? (params.extra as Record<string, unknown>)
      : undefined;

  return {
    temperature: typeof params.temperature === "number" ? params.temperature : "",
    topP: typeof params.topP === "number" ? params.topP : "",
    maxOutputTokens: typeof params.maxOutputTokens === "number" ? params.maxOutputTokens : "",
    stop: stopText,
    ...(preservedExtra ? { preservedExtra } : {}),
  };
}

export function callParamsDraftToValue(
  draft: CallParamsDraft,
): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (draft.temperature !== "") out.temperature = draft.temperature;
  if (draft.topP !== "") out.topP = draft.topP;
  if (draft.maxOutputTokens !== "") out.maxOutputTokens = draft.maxOutputTokens;

  const stopLines = draft.stop
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (stopLines.length === 1) out.stop = stopLines[0];
  else if (stopLines.length > 1) out.stop = stopLines;

  if (draft.preservedExtra && Object.keys(draft.preservedExtra).length > 0) {
    out.extra = draft.preservedExtra;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** 调用参数：UI 不编辑 extra，但回写保留已有值 */
export function callParamsRoundTrip(raw: unknown): Record<string, unknown> | undefined {
  return callParamsDraftToValue(readCallParamsDraft(raw));
}

export function sceneListSubtitle(entry: Record<string, unknown>): string {
  const chain = readChain(entry.chain);
  const primary = chain[0];
  if (!primary || (!primary.provider && !primary.model)) return "未配置路由";
  const main = [primary.provider, primary.model].filter(Boolean).join(" / ");
  const backup = chain.length > 1 ? ` · ${chain.length - 1} 个备用` : "";
  return main + backup;
}

/** 保存前规范化：去掉空 hop，保留非空 params（含静默保留的 extra） */
export function profilesDraftToPatch(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const entries = readHabitatConfigRecord(draft);
  const out: Record<string, unknown> = {};
  for (const [id, profile] of Object.entries(entries)) {
    const chain = readChain(profile.chain)
      .map(normalizeHop)
      .filter((hop) => hop.provider && hop.model);
    const params =
      profile.params && typeof profile.params === "object" && !Array.isArray(profile.params)
        ? (profile.params as Record<string, unknown>)
        : undefined;
    const next: Record<string, unknown> = { ...profile, chain };
    if (params && Object.keys(params).length > 0) next.params = params;
    else delete next.params;
    out[id] = next;
  }
  return out;
}
