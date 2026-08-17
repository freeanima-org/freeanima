import {
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_OPENROUTER,
  LLM_FORMAT_OPENAI_RESPONSES,
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  normalizeLlmProviderRaw,
  normalizeOptionalTitle,
  DEFAULT_EDGE_TTS_BASE_URL,
  VOICE_PROTOCOL_EDGE_TTS,
} from "@freeanima/habitat/core/config";
import { getLlmPreset, presetModalityFields } from "@freeanima/habitat/core/llm/presets";
import { readHabitatConfigRecord } from "./habitat-config-field-helpers.tsx";
import { coerceString } from "@freeanima/shared/coerce-string";
import { randomUuid } from "@freeanima/shared/util/random-uuid.ts";

export function providersDraftToPatch(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const entries = readHabitatConfigRecord(draft);
  const out: Record<string, unknown> = {};
  for (const [id, provider] of Object.entries(entries)) {
    const normalized = normalizeLlmProviderRaw(provider) as Record<string, unknown>;
    const preset = coerceString(normalized.preset ?? LLM_PRESET_CUSTOM);
    if (preset !== LLM_PRESET_CUSTOM) {
      const suite = presetModalityFields(preset as typeof LLM_PRESET_DEEPSEEK);
      for (const [k, v] of Object.entries(suite)) {
        if (!(k in normalized)) normalized[k] = v;
      }
      // 内置预设不落盘可改 base_url（运行时用固定根）
      delete normalized.base_url;
    }
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
    hint: "对话 + 文生图 + 语音合成（OpenAI 兼容根；Anthropic 另建连接）",
  },
  {
    id: LLM_PRESET_OPENCODE_GO,
    label: "OpenCode Go",
    hint: "多格式对话网关 · 无文生图/向量/语音",
  },
  {
    id: LLM_PRESET_CUSTOM,
    label: "自定义",
    hint: "自行指定各模态协议与 Base URL",
  },
] as const;

export const LLM_SETTINGS_FORMATS = [
  { id: LLM_FORMAT_OPENAI_COMPATIBLE, label: "Chat Completions", code: "openai_compatible" },
  { id: LLM_FORMAT_OPENAI_RESPONSES, label: "Responses", code: "openai_responses" },
  { id: LLM_FORMAT_ANTHROPIC_MESSAGES, label: "Messages", code: "anthropic_messages" },
] as const;

/** 对话场景族 */
export const DIALOGUE_SCENE_ROWS = [
  { id: "chat", label: "聊天" },
  { id: "summary", label: "会话压缩 / 标题" },
  { id: "reflect", label: "反思" },
  { id: "goal_judge", label: "目标判定" },
  { id: "skill_review", label: "技能审阅" },
] as const;

/** 文生图场景族 */
export const IMAGE_SCENE_ROWS = [{ id: "image_generate", label: "图片生成" }] as const;

/** 语音合成场景族（主：文生声；子：朗读 / 实时） */
export const VOICE_SCENE_ROWS = [
  { id: "voice_generate", label: "文生声" },
  { id: "tts", label: "朗读" },
  { id: "voice_realtime", label: "实时语音对话" },
] as const;

/** 向量 / 检索场景族 */
export const RETRIEVAL_SCENE_ROWS = [{ id: "embedding", label: "向量嵌入" }] as const;

/** @deprecated 勿再用于「一张总表」；请用各族 *_SCENE_ROWS */
export const LLM_SYSTEM_PURPOSE_ROWS = [
  ...DIALOGUE_SCENE_ROWS,
  ...RETRIEVAL_SCENE_ROWS,
  ...IMAGE_SCENE_ROWS,
  ...VOICE_SCENE_ROWS,
] as const;

export const LLM_SETTINGS_IMAGE_PROTOCOLS = [
  { id: "", label: "无" },
  { id: "openai_images", label: "OpenAI Images", code: "openai_images" },
  {
    id: "alibaba_multimodal",
    label: "阿里云多模态生成（万相/千问文生图）",
    code: "alibaba_multimodal",
  },
] as const;

export const LLM_SETTINGS_EMBEDDINGS_PROTOCOLS = [
  { id: "", label: "无" },
  { id: "openai_embeddings", label: "OpenAI Embeddings", code: "openai_embeddings" },
] as const;

export const LLM_SETTINGS_VOICE_PROTOCOLS = [
  { id: "", label: "无" },
  { id: "edge-tts", label: "Edge TTS", code: "edge-tts" },
  { id: "openai_audio_speech", label: "OpenAI Audio Speech", code: "openai_audio_speech" },
  { id: "alibaba_audio", label: "阿里云音频（DashScope）", code: "alibaba_audio" },
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

/** 新建方案（profile）id */
export function newSceneId(): string {
  return `s-${shortIdSuffix()}`;
}

export function llmPresetLabel(presetId: string): string {
  return LLM_SETTINGS_PRESETS.find((p) => p.id === presetId)?.label ?? presetId;
}

export function llmFormatLabel(formatId: string): string {
  const hit = LLM_SETTINGS_FORMATS.find((f) => f.id === formatId);
  return hit ? `${hit.label}（${hit.code}）` : formatId;
}

/** 列表副文：预设名 + URL（内置预设固定根；自定义未填则提示） */
export function connectionListSubtitle(entry: Record<string, unknown>): string {
  const preset = coerceString(entry.preset ?? LLM_PRESET_CUSTOM);
  const label = llmPresetLabel(preset);
  if (preset !== LLM_PRESET_CUSTOM) {
    const def = getLlmPreset(preset as typeof LLM_PRESET_DEEPSEEK);
    const fixed = def?.defaultBaseUrl;
    return fixed ? `${label} · ${fixed}` : label;
  }
  const base = typeof entry.base_url === "string" ? entry.base_url.trim() : "";
  if (base) return `${label} · ${base}`;
  return `${label} · 未填 Base URL`;
}

export function connectionDefaultBaseUrl(presetId: string): string | null {
  if (presetId === LLM_PRESET_CUSTOM) return null;
  const def = getLlmPreset(presetId as typeof LLM_PRESET_DEEPSEEK);
  return def?.defaultBaseUrl ?? null;
}

/** 将内置预设的全套模态协议写回连接草稿；并清除可覆盖的 base_url（运行时用预设固定根） */
export function applyPresetToConnectionEntry(
  entry: Record<string, unknown>,
  presetId: string,
): Record<string, unknown> {
  if (presetId === LLM_PRESET_CUSTOM) {
    return {
      ...entry,
      preset: LLM_PRESET_CUSTOM,
      format: entry.format ?? LLM_FORMAT_OPENAI_COMPATIBLE,
      text_protocol: entry.text_protocol ?? entry.format ?? LLM_FORMAT_OPENAI_COMPATIBLE,
    };
  }
  const modalities = presetModalityFields(presetId as typeof LLM_PRESET_DEEPSEEK);
  const next: Record<string, unknown> = {
    ...entry,
    preset: presetId,
    ...modalities,
  };
  delete next.base_url;
  return next;
}

function protocolLabel(kind: "text" | "image" | "embeddings" | "voice", id: string | null): string {
  if (id == null || id === "") return "无";
  if (kind === "text") {
    if (id === "gateway") return "按模型自动";
    return llmFormatLabel(id);
  }
  if (kind === "image") {
    return LLM_SETTINGS_IMAGE_PROTOCOLS.find((p) => p.id === id)?.label ?? id;
  }
  if (kind === "embeddings") {
    return LLM_SETTINGS_EMBEDDINGS_PROTOCOLS.find((p) => p.id === id)?.label ?? id;
  }
  return LLM_SETTINGS_VOICE_PROTOCOLS.find((p) => p.id === id)?.label ?? id;
}

/** 预设协议套件摘要（只读展示） */
export function presetModalitySuiteSummary(presetId: string): string | null {
  if (presetId === LLM_PRESET_CUSTOM) return null;
  const def = getLlmPreset(presetId as typeof LLM_PRESET_DEEPSEEK);
  if (!def) return null;
  const text = def.modalities.text === "gateway" ? "gateway" : def.modalities.text;
  return [
    `对话 ${protocolLabel("text", text)}`,
    `文生图 ${protocolLabel("image", def.modalities.image)}`,
    `向量 ${protocolLabel("embeddings", def.modalities.embeddings)}`,
    `语音 ${protocolLabel("voice", def.modalities.voice)}`,
  ].join(" · ");
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
    text_protocol: LLM_FORMAT_OPENAI_COMPATIBLE,
  };
}

/** Edge TTS 专用连接草稿（密钥可空，base_url 默认可改） */
export function emptyEdgeTtsConnectionEntry(): Record<string, unknown> {
  return {
    preset: LLM_PRESET_CUSTOM,
    title: "Edge TTS",
    voice_protocol: VOICE_PROTOCOL_EDGE_TTS,
    base_url: DEFAULT_EDGE_TTS_BASE_URL,
    api_key: "",
  };
}

/** 场景用途按设置侧栏拆分 */
export const LLM_PURPOSE_IDS_DIALOGUE = DIALOGUE_SCENE_ROWS.map((r) => r.id);
export const LLM_PURPOSE_IDS_IMAGE = IMAGE_SCENE_ROWS.map((r) => r.id);
export const LLM_PURPOSE_IDS_VOICE = VOICE_SCENE_ROWS.map((r) => r.id);
export const LLM_PURPOSE_IDS_RETRIEVAL = RETRIEVAL_SCENE_ROWS.map((r) => r.id);

export function purposeRowsForFocus(
  focus: "connections" | "dialogue" | "image_gen" | "retrieval" | "voice" | "all",
): ReadonlyArray<{ id: string; label: string }> {
  if (focus === "dialogue") return DIALOGUE_SCENE_ROWS;
  if (focus === "image_gen") return IMAGE_SCENE_ROWS;
  if (focus === "retrieval") return RETRIEVAL_SCENE_ROWS;
  if (focus === "voice") return VOICE_SCENE_ROWS;
  return LLM_SYSTEM_PURPOSE_ROWS;
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
  return [primary.provider, primary.model].filter(Boolean).join(" / ");
}

function profileHasUsableChain(entry: Record<string, unknown> | undefined): boolean {
  if (!entry) return false;
  const chain = readChain(entry.chain);
  const primary = chain[0];
  return Boolean(primary?.provider && primary?.model);
}

/** 读 profile_bindings；非法结构视为空 */
export function readProfileBindings(raw: unknown): Record<string, string | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null) out[key] = null;
    else if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * 系统用途下拉回显值：
 * - 有 bindings 键：null/"" → ""（同主场景）；否则绑定 id
 * - 无键：若 profiles[purpose] 可用 → 自指该 id；否则 ""（同主场景）
 */
export function systemPurposeSelectValue(
  purposeId: string,
  bindings: Record<string, string | null>,
  profiles: Record<string, unknown>,
): string {
  if (Object.prototype.hasOwnProperty.call(bindings, purposeId)) {
    const bound = bindings[purposeId];
    if (bound == null || bound === "") return "";
    return bound;
  }
  const entry = readHabitatConfigRecord(profiles)[purposeId];
  if (profileHasUsableChain(entry)) return purposeId;
  return "";
}

/** 保存前规范化：去掉空 hop，保留非空 params（含静默保留的 extra），trim title */
export function profilesDraftToPatch(
  draft: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const entries = readHabitatConfigRecord(draft);
  const out: Record<string, unknown> = {};
  for (const [id, profile] of Object.entries(entries)) {
    const chain = readChain(profile.chain)
      .map(normalizeHop)
      .filter((hop) => hop.provider && hop.model)
      .slice(0, 1);
    const params =
      profile.params && typeof profile.params === "object" && !Array.isArray(profile.params)
        ? (profile.params as Record<string, unknown>)
        : undefined;
    const next: Record<string, unknown> = { ...profile, chain };
    const title = normalizeOptionalTitle(profile.title);
    if (title) next.title = title;
    else delete next.title;
    if (params && Object.keys(params).length > 0) next.params = params;
    else delete next.params;
    out[id] = next;
  }
  return out;
}

/**
 * 从 profiles + bindings（及已有 scenes）合成扁平 scenes 写入。
 * 系统用途优先；其余 profile id 也落入 scenes（兼容自定义方案）。
 * @deprecated 日常场景 UI 已改为直接写 scenes；保留给遗留「自定义方案」保存路径。
 */
export function scenesDraftFromProfilesAndBindings(opts: {
  profiles: Record<string, unknown>;
  bindings: Record<string, string | null>;
  defaultProfile: string;
  existingScenes?: Record<string, unknown>;
}): Record<string, unknown> {
  const profiles = readHabitatConfigRecord(opts.profiles);
  const existing = readHabitatConfigRecord(opts.existingScenes);
  const out: Record<string, unknown> = { ...existing };
  const defaultId = opts.defaultProfile.trim() || "chat";

  const hop0Of = (profileId: string): { connection: string; model: string } | null => {
    const entry = profiles[profileId];
    const hop = readChain(entry?.chain)[0];
    if (!hop?.provider || !hop.model) return null;
    return { connection: hop.provider, model: hop.model };
  };

  const setPurpose = (purpose: string, profileId: string) => {
    const hop = hop0Of(profileId);
    if (!hop) return;
    out[purpose] = {
      connection: hop.connection,
      model: hop.model,
    };
  };

  setPurpose(defaultId, defaultId);
  setPurpose("chat", defaultId);

  for (const row of LLM_SYSTEM_PURPOSE_ROWS) {
    const purpose = row.id;
    if (Object.prototype.hasOwnProperty.call(opts.bindings, purpose)) {
      const bound = opts.bindings[purpose];
      const profileId = bound == null || bound === "" ? defaultId : bound;
      setPurpose(purpose, profileId);
    } else if (profileHasUsableChain(profiles[purpose])) {
      setPurpose(purpose, purpose);
    }
  }

  for (const [id] of Object.entries(profiles)) {
    if (!out[id]) setPurpose(id, id);
  }

  return out;
}

/** 扁平场景绑定草稿；`null` = 同主场景（不写该用途键） */
export type SceneBindingDraft = {
  connection: string;
  model: string;
};

export function readSceneBindingDraft(raw: unknown): SceneBindingDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const connection = typeof o.connection === "string" ? o.connection.trim() : "";
  const model = typeof o.model === "string" ? o.model.trim() : "";
  if (!connection && !model) return null;
  return { connection, model };
}

function hop0AsSceneBinding(
  profile: Record<string, unknown> | undefined,
): SceneBindingDraft | null {
  const hop = readChain(profile?.chain)[0];
  if (!hop?.provider || !hop.model) return null;
  return { connection: hop.provider, model: hop.model };
}

/**
 * 从 llm 段读出场景 UI 草稿：优先 scenes；chat 可回退 profiles。
 * 子用途无独立 scenes 键 → null（同主场景）。按能力族分别读取。
 */
export function readScenesUiDraft(
  llm: Record<string, unknown>,
): Record<string, SceneBindingDraft | null> {
  const scenes = readHabitatConfigRecord(llm.scenes as Record<string, unknown> | undefined);
  const profiles = readHabitatConfigRecord(llm.profiles as Record<string, unknown> | undefined);
  const defaultId =
    typeof llm.default_scene === "string" && llm.default_scene.trim()
      ? llm.default_scene.trim()
      : typeof llm.default_profile === "string" && llm.default_profile.trim()
        ? llm.default_profile.trim()
        : "chat";

  const out: Record<string, SceneBindingDraft | null> = {};
  const allRows = [
    ...DIALOGUE_SCENE_ROWS,
    ...IMAGE_SCENE_ROWS,
    ...VOICE_SCENE_ROWS,
    ...RETRIEVAL_SCENE_ROWS,
  ];
  for (const row of allRows) {
    const fromScene = readSceneBindingDraft(scenes[row.id]);
    if (fromScene?.connection && fromScene.model) {
      out[row.id] = fromScene;
      continue;
    }
    if (row.id === "chat") {
      out.chat = hop0AsSceneBinding(profiles.chat) ??
        hop0AsSceneBinding(profiles[defaultId]) ?? { connection: "", model: "" };
    } else if (row.id === "voice_generate") {
      // 遗留：仅有 tts 时在 UI 上展示为文生声主场景
      const fromTts = readSceneBindingDraft(scenes.tts);
      out.voice_generate = fromTts?.connection && fromTts.model ? fromTts : null;
    } else {
      out[row.id] = null;
    }
  }
  return out;
}

/** 只更新指定用途键；null/空 → 写入 null（merge 时删除该用途，同主场景） */
export function scenesUiDraftToPatch(
  draft: Record<string, SceneBindingDraft | null>,
  existingScenes: Record<string, unknown> | null | undefined,
  purposes: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const existing = readHabitatConfigRecord(existingScenes);
  for (const purpose of purposes) {
    const v = draft[purpose];
    if (v == null || !v.connection.trim() || !v.model.trim()) {
      // 仅当库里已有该键时发 tombstone，避免无意义 null
      if (Object.prototype.hasOwnProperty.call(existing, purpose)) {
        out[purpose] = null;
      }
    } else {
      out[purpose] = {
        connection: v.connection.trim(),
        model: v.model.trim(),
      };
    }
  }
  return out;
}

export function purposeIdsForFocus(
  focus: "connections" | "dialogue" | "image_gen" | "retrieval" | "voice" | "all",
): string[] {
  return purposeRowsForFocus(focus).map((r) => r.id);
}
