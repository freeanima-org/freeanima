import {
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_OPENROUTER,
  LLM_FORMAT_OPENAI_RESPONSES,
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  normalizeConnectionRaw,
  normalizeOptionalTitle,
  DEFAULT_EDGE_TTS_BASE_URL,
  AUDIO_PROTOCOL_EDGE_TTS,
  type CustomKindId,
} from "@freeanima/habitat/core/config";
import {
  getLlmPreset,
  presetModalityFields,
  connectionSupportsLayer,
} from "@freeanima/habitat/core/llm/presets";
import { readHabitatConfigRecord } from "./habitat-config-field-helpers.tsx";
import { coerceString } from "@freeanima/shared/coerce-string";
import { randomUuid } from "@freeanima/shared/util/random-uuid.ts";

export type ConnectionLayerId = CustomKindId;

export const CONNECTION_LAYERS = [
  { id: "text", label: "文本生成" },
  { id: "image", label: "图片生成" },
  { id: "audio", label: "音频生成" },
  { id: "video", label: "视频生成" },
  { id: "embeddings", label: "文本嵌入" },
] as const satisfies ReadonlyArray<{ id: ConnectionLayerId; label: string }>;

export function providersDraftToPatch(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const entries = readHabitatConfigRecord(draft);
  const out: Record<string, unknown> = {};
  for (const [id, provider] of Object.entries(entries)) {
    const normalized = normalizeConnectionRaw(provider) as Record<string, unknown>;
    delete normalized.format;
    delete normalized.backend;
    delete normalized.voice_protocol;
    const preset = coerceString(normalized.preset ?? LLM_PRESET_CUSTOM);
    if (preset !== LLM_PRESET_CUSTOM) {
      const suite = presetModalityFields(preset as typeof LLM_PRESET_DEEPSEEK);
      for (const [k, v] of Object.entries(suite)) {
        normalized[k] = v;
      }
      delete normalized.base_url;
      delete normalized.custom_kind;
    } else {
      stripProtocolsNotForKind(normalized);
    }
    out[id] = normalized;
  }
  return out;
}

function stripProtocolsNotForKind(entry: Record<string, unknown>): void {
  const kind = coerceString(entry.custom_kind);
  if (kind !== "text") delete entry.text_protocol;
  if (kind !== "image") delete entry.image_protocol;
  if (kind !== "audio") delete entry.audio_protocol;
  if (kind !== "embeddings") delete entry.embeddings_protocol;
  if (kind !== "video") delete entry.video_protocol;
}

export function readProvidersDraft(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return providersDraftToPatch(draft);
}

export const LLM_SETTINGS_PRESETS = [
  {
    id: LLM_PRESET_DEEPSEEK,
    label: "DeepSeek",
    hint: "对话 Completions · 无文生图/向量/语音",
  },
  {
    id: LLM_PRESET_OPENROUTER,
    label: "OpenRouter",
    hint: "对话 + 文生图 + 向量（OpenAI 兼容根）",
  },
  {
    id: LLM_PRESET_ALIBABA_TOKEN_PLAN,
    label: "阿里云 Token Plan",
    hint: "对话 + 文生图 + 语音合成（厂商协议，不必 OpenAI 封装）",
  },
  {
    id: LLM_PRESET_OPENCODE_GO,
    label: "OpenCode Go",
    hint: "多格式对话网关 · 无文生图/向量/语音",
  },
  {
    id: LLM_PRESET_CUSTOM,
    label: "自定义",
    hint: "只覆盖一层；仅该层通用协议",
  },
] as const;

export const LLM_SETTINGS_FORMATS = [
  { id: LLM_FORMAT_OPENAI_COMPATIBLE, label: "Chat Completions", code: "openai_compatible" },
  { id: LLM_FORMAT_OPENAI_RESPONSES, label: "Responses", code: "openai_responses" },
  { id: LLM_FORMAT_ANTHROPIC_MESSAGES, label: "Messages", code: "anthropic_messages" },
] as const;

export const TEXT_GENERATE_ROWS = [
  { id: "chat", label: "聊天", configKey: "main" },
  { id: "summary", label: "会话压缩 / 标题", configKey: "summary" },
  { id: "reflect", label: "反思", configKey: "reflect" },
  { id: "goal_judge", label: "目标判定", configKey: "goal_judge" },
  { id: "skill_review", label: "技能审阅", configKey: "skill_review" },
] as const;

export const IMAGE_GENERATE_ROWS = [
  { id: "image_generate", label: "图片生成", configKey: "main" },
] as const;

export const AUDIO_GENERATE_ROWS = [
  { id: "voice_generate", label: "文生声", configKey: "main" },
  { id: "tts", label: "朗读", configKey: "tts" },
  { id: "voice_realtime", label: "实时语音对话", configKey: "voice_realtime" },
] as const;

export const VIDEO_GENERATE_ROWS = [
  { id: "video_generate", label: "视频生成", configKey: "main" },
] as const;

export const EMBEDDING_ROWS = [{ id: "embedding", label: "文本嵌入", configKey: "main" }] as const;

export const LLM_SETTINGS_GENERIC_IMAGE_PROTOCOLS = [
  { id: "openai_images", label: "OpenAI Images", code: "openai_images" },
] as const;

export const LLM_SETTINGS_GENERIC_EMBEDDINGS_PROTOCOLS = [
  { id: "openai_embeddings", label: "OpenAI Embeddings", code: "openai_embeddings" },
] as const;

export const LLM_SETTINGS_GENERIC_AUDIO_PROTOCOLS = [
  { id: "openai_audio_speech", label: "OpenAI Audio Speech", code: "openai_audio_speech" },
  { id: "edge-tts", label: "Edge TTS", code: "edge-tts" },
] as const;

export function llmEntryTitle(
  id: string,
  entry: Record<string, unknown> | null | undefined,
  builtinFallback?: string,
): string {
  const title = normalizeOptionalTitle(entry?.title);
  if (title) return title;
  if (builtinFallback) return builtinFallback;
  return id;
}

function shortIdSuffix(): string {
  return randomUuid().replace(/-/g, "").slice(0, 8);
}

export function newConnectionId(): string {
  return `c-${shortIdSuffix()}`;
}

export function llmPresetLabel(presetId: string): string {
  return LLM_SETTINGS_PRESETS.find((p) => p.id === presetId)?.label ?? presetId;
}

export function llmFormatLabel(formatId: string): string {
  const hit = LLM_SETTINGS_FORMATS.find((f) => f.id === formatId);
  return hit ? `${hit.label}（${hit.code}）` : formatId;
}

export function connectionListSubtitle(entry: Record<string, unknown>): string {
  const preset = coerceString(entry.preset ?? LLM_PRESET_CUSTOM);
  const label = llmPresetLabel(preset);
  if (preset !== LLM_PRESET_CUSTOM) {
    const def = getLlmPreset(preset as typeof LLM_PRESET_DEEPSEEK);
    const fixed = def?.defaultBaseUrl;
    return fixed ? `${label} · ${fixed}` : label;
  }
  const kind = CONNECTION_LAYERS.find((l) => l.id === entry.custom_kind)?.label;
  const base = typeof entry.base_url === "string" ? entry.base_url.trim() : "";
  const kindBit = kind ? `${label} · ${kind}` : label;
  if (base) return `${kindBit} · ${base}`;
  return `${kindBit} · 未填 Base URL`;
}

export function connectionDefaultBaseUrl(presetId: string): string | null {
  if (presetId === LLM_PRESET_CUSTOM) return null;
  const def = getLlmPreset(presetId as typeof LLM_PRESET_DEEPSEEK);
  return def?.defaultBaseUrl ?? null;
}

export function applyCustomKindToConnectionEntry(
  entry: Record<string, unknown>,
  kind: ConnectionLayerId,
): Record<string, unknown> {
  return applyPresetToConnectionEntry(entry, LLM_PRESET_CUSTOM, kind);
}

export function applyPresetToConnectionEntry(
  entry: Record<string, unknown>,
  presetId: string,
  lockedKind?: ConnectionLayerId,
): Record<string, unknown> {
  if (presetId === LLM_PRESET_CUSTOM) {
    const kind = (lockedKind ?? coerceString(entry.custom_kind) ?? "text") || "text";
    const next = emptyConnectionEntry(kind as ConnectionLayerId, {
      title: coerceString(entry.title ?? ""),
    });
    if (entry.api_key != null) next.api_key = entry.api_key;
    if (entry.timeout_ms != null) next.timeout_ms = entry.timeout_ms;
    if (entry.first_byte_timeout_ms != null) {
      next.first_byte_timeout_ms = entry.first_byte_timeout_ms;
    }
    if (entry.idle_timeout_ms != null) next.idle_timeout_ms = entry.idle_timeout_ms;
    if (entry.base_url != null && entry.base_url !== "") next.base_url = entry.base_url;
    return next;
  }
  const modalities = presetModalityFields(presetId as typeof LLM_PRESET_DEEPSEEK);
  const next: Record<string, unknown> = {
    ...entry,
    preset: presetId,
    ...modalities,
  };
  delete next.base_url;
  delete next.custom_kind;
  return next;
}

function protocolLabel(kind: "text" | "image" | "embeddings" | "audio", id: string | null): string {
  if (id == null || id === "") return "无";
  if (kind === "text") {
    if (id === "gateway") return "按模型自动";
    return llmFormatLabel(id);
  }
  if (kind === "image") {
    return id === "alibaba_multimodal" ? "阿里云多模态生成" : "OpenAI Images";
  }
  if (kind === "embeddings") return "OpenAI Embeddings";
  if (id === "alibaba_audio") return "阿里云音频（DashScope）";
  if (id === "edge-tts") return "Edge TTS";
  return "OpenAI Audio Speech";
}

export function presetModalitySuiteSummary(presetId: string): string | null {
  if (presetId === LLM_PRESET_CUSTOM) return null;
  const def = getLlmPreset(presetId as typeof LLM_PRESET_DEEPSEEK);
  if (!def) return null;
  const text = def.modalities.text === "gateway" ? "gateway" : def.modalities.text;
  return [
    `对话 ${protocolLabel("text", text)}`,
    `文生图 ${protocolLabel("image", def.modalities.image)}`,
    `向量 ${protocolLabel("embeddings", def.modalities.embeddings)}`,
    `语音 ${protocolLabel("audio", def.modalities.audio)}`,
    `视频 ${def.modalities.video ?? "无"}`,
  ].join(" · ");
}

export type TimeoutDraft = {
  timeout_ms: number | "";
  connect_timeout_ms: number | "";
  first_byte_timeout_ms: number | "";
  idle_timeout_ms: number | "";
};

export function readTimeoutDraft(entry: Record<string, unknown>): TimeoutDraft {
  return {
    timeout_ms: typeof entry.timeout_ms === "number" ? entry.timeout_ms : "",
    connect_timeout_ms:
      typeof entry.connect_timeout_ms === "number" ? entry.connect_timeout_ms : "",
    first_byte_timeout_ms:
      typeof entry.first_byte_timeout_ms === "number" ? entry.first_byte_timeout_ms : "",
    idle_timeout_ms: typeof entry.idle_timeout_ms === "number" ? entry.idle_timeout_ms : "",
  };
}

/** 连接 / 首字节 / idle 须 ≤ overall；空值跳过 */
export function validateTimeoutDraft(draft: TimeoutDraft): string | null {
  const overall = draft.timeout_ms;
  if (overall === "") return null;
  if (
    draft.connect_timeout_ms !== "" &&
    typeof draft.connect_timeout_ms === "number" &&
    draft.connect_timeout_ms > overall
  ) {
    return "连接超时须 ≤ 整体超时";
  }
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

export function emptyConnectionEntry(
  kind: ConnectionLayerId = "text",
  extra?: { title?: string },
): Record<string, unknown> {
  const title = extra?.title?.trim();
  const base: Record<string, unknown> = {
    preset: LLM_PRESET_CUSTOM,
    custom_kind: kind,
    ...(title ? { title } : {}),
  };
  if (kind === "text") base.text_protocol = LLM_FORMAT_OPENAI_COMPATIBLE;
  if (kind === "image") base.image_protocol = "openai_images";
  if (kind === "audio") base.audio_protocol = "openai_audio_speech";
  if (kind === "embeddings") base.embeddings_protocol = "openai_embeddings";
  if (kind === "audio") {
    /* default OpenAI speech; Edge 可改协议后填默认根 */
  }
  return base;
}

export function emptyEdgeTtsConnectionEntry(): Record<string, unknown> {
  return {
    preset: LLM_PRESET_CUSTOM,
    custom_kind: "audio",
    title: "Edge TTS",
    audio_protocol: AUDIO_PROTOCOL_EDGE_TTS,
    base_url: DEFAULT_EDGE_TTS_BASE_URL,
    api_key: "",
  };
}

export function connectionIdsForLayer(
  layer: ConnectionLayerId,
  connectionIds: string[],
  providersById: Record<string, Record<string, unknown>>,
): string[] {
  return connectionIds.filter((id) => connectionSupportsLayer(providersById[id] ?? {}, layer));
}

export type SceneBindingDraft = {
  connection: string;
  model: string;
  params?: Record<string, unknown>;
};

export function sceneDraftVoice(draft: SceneBindingDraft): string {
  const v = draft.params?.voice;
  return typeof v === "string" ? v.trim() : "";
}

export function withSceneDraftVoice(draft: SceneBindingDraft, voice: string): SceneBindingDraft {
  const trimmed = voice.trim();
  const nextParams: Record<string, unknown> = { ...draft.params };
  if (trimmed) nextParams.voice = trimmed;
  else delete nextParams.voice;
  const params = Object.keys(nextParams).length > 0 ? nextParams : undefined;
  if (params) return { ...draft, params };
  const { params: _omit, ...rest } = draft;
  return rest;
}

export function readSceneBindingDraft(raw: unknown): SceneBindingDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const connection = typeof o.connection === "string" ? o.connection.trim() : "";
  const model = typeof o.model === "string" ? o.model.trim() : "";
  if (!connection && !model) return null;
  const params =
    o.params && typeof o.params === "object" && !Array.isArray(o.params)
      ? (o.params as Record<string, unknown>)
      : undefined;
  return {
    connection,
    model,
    ...(params && Object.keys(params).length > 0 ? { params } : {}),
  };
}

export type CapabilityPanelFocus =
  | "text_generate"
  | "image_generate"
  | "audio_generate"
  | "video_generate"
  | "embedding";

export function purposeRowsForFocus(
  focus: CapabilityPanelFocus,
): ReadonlyArray<{ id: string; label: string; configKey: string }> {
  if (focus === "text_generate") return TEXT_GENERATE_ROWS;
  if (focus === "image_generate") return IMAGE_GENERATE_ROWS;
  if (focus === "audio_generate") return AUDIO_GENERATE_ROWS;
  if (focus === "video_generate") return VIDEO_GENERATE_ROWS;
  return EMBEDDING_ROWS;
}

export function readCapabilityUiDraft(
  section: Record<string, unknown> | null | undefined,
  focus: CapabilityPanelFocus,
): Record<string, SceneBindingDraft | null> {
  const src = section ?? {};
  const out: Record<string, SceneBindingDraft | null> = {};
  for (const row of purposeRowsForFocus(focus)) {
    const raw = src[row.configKey];
    if (row.configKey === "main") {
      out[row.id] = readSceneBindingDraft(raw) ?? { connection: "", model: "" };
    } else if (raw == null) {
      out[row.id] = null;
    } else {
      out[row.id] = readSceneBindingDraft(raw);
    }
  }
  return out;
}

function bindingPayload(v: SceneBindingDraft): Record<string, unknown> {
  const params =
    v.params && typeof v.params === "object" && Object.keys(v.params).length > 0
      ? v.params
      : undefined;
  return {
    connection: v.connection.trim(),
    model: v.model.trim(),
    ...(params ? { params } : {}),
  };
}

/** 整段写入：省略的子场景键不出现（同 main） */
export function capabilityUiDraftToSection(
  draft: Record<string, SceneBindingDraft | null>,
  focus: CapabilityPanelFocus,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = extra ? { ...extra } : {};
  for (const row of purposeRowsForFocus(focus)) {
    const v = draft[row.id];
    if (row.configKey === "main") {
      if (v && v.connection.trim() && v.model.trim()) out.main = bindingPayload(v);
      continue;
    }
    if (v != null && v.connection.trim() && v.model.trim()) {
      out[row.configKey] = bindingPayload(v);
    }
  }
  return out;
}

export type CallParamsDraft = {
  temperature: number | "";
  topP: number | "";
  maxOutputTokens: number | "";
  stop: string;
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

export function callParamsRoundTrip(raw: unknown): Record<string, unknown> | undefined {
  return callParamsDraftToValue(readCallParamsDraft(raw));
}
