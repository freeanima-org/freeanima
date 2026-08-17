import { z } from "zod";
import { omitUndefined } from "@freeanima/habitat/core/util";

/** Format ids = wire-protocol adapters (`LlmBackend.id`). */
export const LLM_FORMAT_OPENAI_COMPATIBLE = "openai_compatible";
export const LLM_FORMAT_OPENAI_RESPONSES = "openai_responses";
export const LLM_FORMAT_ANTHROPIC_MESSAGES = "anthropic_messages";

export const LLM_FORMAT_IDS = [
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_FORMAT_OPENAI_RESPONSES,
  LLM_FORMAT_ANTHROPIC_MESSAGES,
] as const;

export type LlmFormatId = (typeof LLM_FORMAT_IDS)[number];

export const LLM_PRESET_DEEPSEEK = "deepseek";
export const LLM_PRESET_OPENROUTER = "openrouter";
export const LLM_PRESET_OPENCODE_GO = "opencode_go";
export const LLM_PRESET_ALIBABA_TOKEN_PLAN = "alibaba_token_plan";
export const LLM_PRESET_CUSTOM = "custom";

export const LLM_PRESET_IDS = [
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENROUTER,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_CUSTOM,
] as const;

export type LlmPresetId = (typeof LLM_PRESET_IDS)[number];

/** 文本对话线协议（= 既有 format） */
export const TEXT_PROTOCOL_IDS = LLM_FORMAT_IDS;
export type TextProtocolId = LlmFormatId;

export const EMBEDDINGS_PROTOCOL_OPENAI = "openai_embeddings";
export const EMBEDDINGS_PROTOCOL_IDS = [EMBEDDINGS_PROTOCOL_OPENAI] as const;
export type EmbeddingsProtocolId = (typeof EMBEDDINGS_PROTOCOL_IDS)[number];

export const IMAGE_PROTOCOL_OPENAI = "openai_images";
/** 阿里云 Token Plan / 百炼多模态生成（wan / qwen-image 等，非 OpenAI Images） */
export const IMAGE_PROTOCOL_ALIBABA_MULTIMODAL = "alibaba_multimodal";
export const IMAGE_PROTOCOL_IDS = [
  IMAGE_PROTOCOL_OPENAI,
  IMAGE_PROTOCOL_ALIBABA_MULTIMODAL,
] as const;
export type ImageProtocolId = (typeof IMAGE_PROTOCOL_IDS)[number];

export const VOICE_PROTOCOL_OPENAI_AUDIO = "openai_audio_speech";
export const VOICE_PROTOCOL_EDGE_TTS = "edge-tts";
export const VOICE_PROTOCOL_IDS = [VOICE_PROTOCOL_OPENAI_AUDIO, VOICE_PROTOCOL_EDGE_TTS] as const;
export type VoiceProtocolId = (typeof VOICE_PROTOCOL_IDS)[number];

/** Edge TTS 默认服务根（密钥可空） */
export const DEFAULT_EDGE_TTS_BASE_URL = "https://api.msedgeservices.com/tts";

/** 扁平场景用途键（含对话子场景 + 媒体） */
export const LLM_SCENE_PURPOSE_IDS = [
  "chat",
  "summary",
  "reflect",
  "goal_judge",
  "skill_review",
  "embedding",
  "image_generate",
  "voice_generate",
  "tts",
] as const;
export type LlmScenePurposeId = (typeof LLM_SCENE_PURPOSE_IDS)[number];

const llmFormatIdSchema = z.enum(LLM_FORMAT_IDS);
const llmPresetIdSchema = z.enum(LLM_PRESET_IDS);
const embeddingsProtocolIdSchema = z.enum(EMBEDDINGS_PROTOCOL_IDS);
const imageProtocolIdSchema = z.enum(IMAGE_PROTOCOL_IDS);
const voiceProtocolIdSchema = z.enum(VOICE_PROTOCOL_IDS);

const timeoutFieldsSchema = {
  /** 整体墙钟超时（ms） */
  timeout_ms: z.number().int().positive().optional(),
  /** 首字节超时（ms）；须 ≤ timeout_ms */
  first_byte_timeout_ms: z.number().int().positive().optional(),
  /** 流式 chunk idle（ms）；须 ≤ timeout_ms */
  idle_timeout_ms: z.number().int().positive().optional(),
};

function refineTimeouts(
  val: {
    timeout_ms?: number;
    first_byte_timeout_ms?: number;
    idle_timeout_ms?: number;
  },
  ctx: z.RefinementCtx,
): void {
  const overall = val.timeout_ms;
  if (overall == null) return;
  if (val.first_byte_timeout_ms != null && val.first_byte_timeout_ms > overall) {
    ctx.addIssue({
      code: "custom",
      path: ["first_byte_timeout_ms"],
      message: "first_byte_timeout_ms must be ≤ timeout_ms",
    });
  }
  if (val.idle_timeout_ms != null && val.idle_timeout_ms > overall) {
    ctx.addIssue({
      code: "custom",
      path: ["idle_timeout_ms"],
      message: "idle_timeout_ms must be ≤ timeout_ms",
    });
  }
}

/** Trim empty `title` so stored config omits blank display names. */
export function normalizeOptionalTitle(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/** Migrate legacy `backend` → `format` / `text_protocol` and default `preset: custom`. */
export function normalizeLlmProviderRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  if (out.format == null && typeof out.backend === "string") {
    out.format = out.backend;
  }
  delete out.backend;
  if (out.text_protocol == null && typeof out.format === "string") {
    out.text_protocol = out.format;
  }
  if (out.format == null && typeof out.text_protocol === "string") {
    out.format = out.text_protocol;
  }
  if (out.preset == null) {
    out.preset = LLM_PRESET_CUSTOM;
  }
  // Legacy configs omitted format/backend → Chat Completions
  if (out.format == null && out.preset === LLM_PRESET_CUSTOM) {
    out.format = LLM_FORMAT_OPENAI_COMPATIBLE;
    out.text_protocol = LLM_FORMAT_OPENAI_COMPATIBLE;
  }
  const title = normalizeOptionalTitle(out.title);
  if (title === undefined) delete out.title;
  else out.title = title;
  return out;
}

/** Normalize profile value objects (trim empty title; chain 仅保留首跳). */
export function normalizeLlmProfileRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  const title = normalizeOptionalTitle(out.title);
  if (title === undefined) delete out.title;
  else out.title = title;
  if (Array.isArray(out.chain) && out.chain.length > 1) {
    out.chain = out.chain.slice(0, 1);
  }
  return out;
}

export const llmProviderSchema = z.preprocess(
  normalizeLlmProviderRaw,
  z
    .object({
      /** 展示名；缺省时 UI 回退 map key */
      title: z.string().min(1).optional(),
      preset: llmPresetIdSchema.default(LLM_PRESET_CUSTOM),
      /**
       * 文本协议（遗留字段名 format，与 text_protocol 同步）。
       * Required for `custom`；单格式预设可省略。
       */
      format: llmFormatIdSchema.optional(),
      /** 文本协议；与 format 同义，新配置优先写此字段 */
      text_protocol: llmFormatIdSchema.optional(),
      /** 文生图协议；null/省略 = 不支持 */
      image_protocol: imageProtocolIdSchema.nullable().optional(),
      /** 文生声 / TTS HTTP 协议；null/省略 = 不支持（web-speech 不进连接表） */
      voice_protocol: voiceProtocolIdSchema.nullable().optional(),
      /** 向量协议；null/省略 = 不支持 */
      embeddings_protocol: embeddingsProtocolIdSchema.nullable().optional(),
      base_url: z.string().url().optional(),
      api_key: z.string().optional(),
      ...timeoutFieldsSchema,
    })
    .strict()
    .superRefine((val, ctx) => {
      refineTimeouts(
        {
          ...(val.timeout_ms !== undefined ? { timeout_ms: val.timeout_ms } : {}),
          ...(val.first_byte_timeout_ms !== undefined
            ? { first_byte_timeout_ms: val.first_byte_timeout_ms }
            : {}),
          ...(val.idle_timeout_ms !== undefined ? { idle_timeout_ms: val.idle_timeout_ms } : {}),
        },
        ctx,
      );
      const textProto = val.text_protocol ?? val.format;
      if (val.preset === LLM_PRESET_CUSTOM) {
        if (textProto == null) {
          ctx.addIssue({
            code: "custom",
            path: ["text_protocol"],
            message: "custom connection requires text_protocol (or format)",
          });
        }
        if (val.base_url == null || !val.base_url.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["base_url"],
            message: "custom connection requires base_url",
          });
        }
      }
      if (val.voice_protocol === VOICE_PROTOCOL_EDGE_TTS) {
        if (val.base_url == null || !val.base_url.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["base_url"],
            message: "edge-tts connection requires base_url",
          });
        }
      }
    }),
);

export const llmRouteHopSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const llmProfileSchema = z.preprocess(
  normalizeLlmProfileRaw,
  z.object({
    /** 展示名；缺省时 UI 回退 map key */
    title: z.string().min(1).optional(),
    /** 仅首跳有效；多跳配置加载时会被截断 */
    chain: z.array(llmRouteHopSchema).min(1).max(1),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
);

/** 扁平场景：用途 → 连接 + 模型（协议从连接读） */
export const llmSceneBindingSchema = z.object({
  connection: z.string().min(1),
  model: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  /** @deprecated 多跳备用已移除；解析时忽略 */
  fallback: z
    .array(
      z.object({
        connection: z.string().min(1),
        model: z.string().min(1),
      }),
    )
    .optional(),
});

export type LlmSceneBinding = z.infer<typeof llmSceneBindingSchema>;

/**
 * Loose provider shape for stored RuntimeConfig / UI drafts.
 * Accepts legacy `backend`; full validation runs at bind via {@link llmProviderSchema}.
 */
export const llmProviderLooseSchema = z.preprocess(
  normalizeLlmProviderRaw,
  z
    .object({
      title: z.string().optional(),
      preset: llmPresetIdSchema.optional(),
      format: llmFormatIdSchema.optional(),
      text_protocol: llmFormatIdSchema.optional(),
      image_protocol: imageProtocolIdSchema.nullable().optional(),
      voice_protocol: voiceProtocolIdSchema.nullable().optional(),
      embeddings_protocol: embeddingsProtocolIdSchema.nullable().optional(),
      base_url: z.string().optional(),
      api_key: z.string().optional(),
      ...timeoutFieldsSchema,
    })
    .passthrough(),
);

/**
 * 用途键 → 方案 id（遗留）。
 * - 键不存在：兼容旧配置（有可用 profiles[用途] 则用之）
 * - null / ""：同主场景 → default_profile
 * - string：使用该 profile
 */
export const llmProfileBindingsSchema = z.record(z.string(), z.string().nullable());

/** 允许分 tab 增量保存：缺 profiles / providers 时给空对象 */
export const llmConfigSchema = z.object({
  default_profile: z.string().min(1).default("chat"),
  /** 主场景用途键；缺省 chat（与 default_profile 对齐） */
  default_scene: z.string().min(1).optional(),
  providers: z.record(z.string(), llmProviderLooseSchema).default({}),
  /** @deprecated 日常路径改用 scenes；保留供迁移与 failover 兼容 */
  profiles: z.record(z.string(), llmProfileSchema).default({}),
  /** @deprecated 改用 scenes；读时归一 */
  profile_bindings: llmProfileBindingsSchema.optional(),
  /** 扁平场景（SSOT，新写入优先） */
  scenes: z.record(z.string(), llmSceneBindingSchema).optional(),
});

/**
 * Connection config (TS). Allows legacy `backend` and omitted `preset` so fixtures /
 * incremental UI drafts type-check; runtime parse via {@link llmProviderSchema} normalizes.
 * Optional fields include `| undefined` for exactOptionalPropertyTypes + Zod output.
 */
export type LlmProviderConfig = {
  title?: string | undefined;
  preset?: LlmPresetId | undefined;
  format?: LlmFormatId | undefined;
  text_protocol?: TextProtocolId | undefined;
  image_protocol?: ImageProtocolId | null | undefined;
  voice_protocol?: VoiceProtocolId | null | undefined;
  embeddings_protocol?: EmbeddingsProtocolId | null | undefined;
  /** @deprecated Migrated to {@link format} by {@link normalizeLlmProviderRaw} */
  backend?: string | undefined;
  base_url?: string | undefined;
  api_key?: string | undefined;
  timeout_ms?: number | undefined;
  first_byte_timeout_ms?: number | undefined;
  idle_timeout_ms?: number | undefined;
};

export type LlmProfileConfig = z.infer<typeof llmProfileSchema>;
export type LlmRouteHopConfig = z.infer<typeof llmRouteHopSchema>;
export type LlmConfig = z.infer<typeof llmConfigSchema>;

export function llmProviderConfigToContext(
  cfg: LlmProviderConfig,
  baseUrl: string,
): Record<string, unknown> {
  return omitUndefined({
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: cfg.api_key,
    timeoutMs: cfg.timeout_ms,
    firstByteTimeoutMs: cfg.first_byte_timeout_ms,
    idleTimeoutMs: cfg.idle_timeout_ms,
  });
}

/** 连接上的文本协议（format / text_protocol） */
export function getProviderTextProtocol(cfg: LlmProviderConfig): TextProtocolId | undefined {
  return cfg.text_protocol ?? cfg.format;
}
