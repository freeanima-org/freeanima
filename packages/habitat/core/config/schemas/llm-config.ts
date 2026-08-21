import { isRecord } from "@freeanima/shared/util";
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
export const LLM_PRESET_OLLAMA = "ollama";
export const LLM_PRESET_CUSTOM = "custom";

export const LLM_PRESET_IDS = [
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENROUTER,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_ALIBABA_TOKEN_PLAN,
  LLM_PRESET_OLLAMA,
  LLM_PRESET_CUSTOM,
] as const;

export type LlmPresetId = (typeof LLM_PRESET_IDS)[number];

export const CUSTOM_KIND_IDS = ["text", "image", "audio", "video", "embeddings"] as const;
export type CustomKindId = (typeof CUSTOM_KIND_IDS)[number];

/** 文本对话线协议（= 既有 format） */
export const TEXT_PROTOCOL_IDS = LLM_FORMAT_IDS;
export type TextProtocolId = LlmFormatId;

export const EMBEDDINGS_PROTOCOL_OPENAI = "openai_embeddings";
export const EMBEDDINGS_PROTOCOL_IDS = [EMBEDDINGS_PROTOCOL_OPENAI] as const;
export type EmbeddingsProtocolId = (typeof EMBEDDINGS_PROTOCOL_IDS)[number];

export const IMAGE_PROTOCOL_OPENAI = "openai_images";
/** 阿里云 Token Plan / 百炼多模态生成（wan / qwen-image 等，非 OpenAI Images） */
export const IMAGE_PROTOCOL_ALIBABA_MULTIMODAL = "alibaba_multimodal";
export const GENERIC_IMAGE_PROTOCOL_IDS = [IMAGE_PROTOCOL_OPENAI] as const;
export const IMAGE_PROTOCOL_IDS = [
  IMAGE_PROTOCOL_OPENAI,
  IMAGE_PROTOCOL_ALIBABA_MULTIMODAL,
] as const;
export type ImageProtocolId = (typeof IMAGE_PROTOCOL_IDS)[number];

export const AUDIO_PROTOCOL_OPENAI_AUDIO = "openai_audio_speech";
export const AUDIO_PROTOCOL_EDGE_TTS = "edge-tts";
/** 阿里云 Token Plan / 百炼 DashScope 音频 */
export const AUDIO_PROTOCOL_ALIBABA_AUDIO = "alibaba_audio";
export const GENERIC_AUDIO_PROTOCOL_IDS = [
  AUDIO_PROTOCOL_OPENAI_AUDIO,
  AUDIO_PROTOCOL_EDGE_TTS,
] as const;
export const AUDIO_PROTOCOL_IDS = [
  AUDIO_PROTOCOL_OPENAI_AUDIO,
  AUDIO_PROTOCOL_EDGE_TTS,
  AUDIO_PROTOCOL_ALIBABA_AUDIO,
] as const;
export type AudioProtocolId = (typeof AUDIO_PROTOCOL_IDS)[number];

/** @deprecated 用 AUDIO_PROTOCOL_* */
export const VOICE_PROTOCOL_OPENAI_AUDIO = AUDIO_PROTOCOL_OPENAI_AUDIO;
export const VOICE_PROTOCOL_EDGE_TTS = AUDIO_PROTOCOL_EDGE_TTS;
export const VOICE_PROTOCOL_ALIBABA_AUDIO = AUDIO_PROTOCOL_ALIBABA_AUDIO;
export const VOICE_PROTOCOL_IDS = AUDIO_PROTOCOL_IDS;
export type VoiceProtocolId = AudioProtocolId;

/** Edge TTS 默认服务根（密钥可空） */
export const DEFAULT_EDGE_TTS_BASE_URL = "https://api.msedgeservices.com/tts";

export const TEXT_GENERATE_PURPOSE_IDS = [
  "chat",
  "summary",
  "reflect",
  "goal_judge",
  "skill_review",
] as const;

export const LLM_SCENE_PURPOSE_IDS = [
  ...TEXT_GENERATE_PURPOSE_IDS,
  "embedding",
  "image_generate",
  "voice_generate",
  "tts",
  "voice_realtime",
  "video_generate",
] as const;
export type LlmScenePurposeId = (typeof LLM_SCENE_PURPOSE_IDS)[number];

export const VOICE_SYNTHESIS_SCENE_PURPOSE_IDS = [
  "voice_generate",
  "tts",
  "voice_realtime",
] as const;
export type VoiceSynthesisScenePurposeId = (typeof VOICE_SYNTHESIS_SCENE_PURPOSE_IDS)[number];

export const VOICE_SYNTHESIS_MAIN_PURPOSE = "voice_generate" as const;
export const VOICE_SYNTHESIS_CHILD_PURPOSE_IDS = ["tts", "voice_realtime"] as const;

const llmFormatIdSchema = z.enum(LLM_FORMAT_IDS);
const llmPresetIdSchema = z.enum(LLM_PRESET_IDS);
const customKindIdSchema = z.enum(CUSTOM_KIND_IDS);
const embeddingsProtocolIdSchema = z.enum(EMBEDDINGS_PROTOCOL_IDS);
const imageProtocolIdSchema = z.enum(IMAGE_PROTOCOL_IDS);
const audioProtocolIdSchema = z.enum(AUDIO_PROTOCOL_IDS);

const timeoutFieldsSchema = {
  timeout_ms: z.number().int().positive().optional(),
  /** 连接 / HTTP 响应头超时（ms）；须 ≤ timeout_ms */
  connect_timeout_ms: z.number().int().positive().optional(),
  first_byte_timeout_ms: z.number().int().positive().optional(),
  idle_timeout_ms: z.number().int().positive().optional(),
};

function refineTimeouts(
  val: {
    timeout_ms?: number;
    connect_timeout_ms?: number;
    first_byte_timeout_ms?: number;
    idle_timeout_ms?: number;
  },
  ctx: z.RefinementCtx,
): void {
  const overall = val.timeout_ms;
  if (overall == null) return;
  if (val.connect_timeout_ms != null && val.connect_timeout_ms > overall) {
    ctx.addIssue({
      code: "custom",
      path: ["connect_timeout_ms"],
      message: "connect_timeout_ms must be ≤ timeout_ms",
    });
  }
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

export function normalizeOptionalTitle(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

function isGenericImageProtocol(id: string): boolean {
  return (GENERIC_IMAGE_PROTOCOL_IDS as readonly string[]).includes(id);
}

function isGenericAudioProtocol(id: string): boolean {
  return (GENERIC_AUDIO_PROTOCOL_IDS as readonly string[]).includes(id);
}

function protocolSet(val: {
  text_protocol?: string | undefined;
  image_protocol?: string | null | undefined;
  audio_protocol?: string | null | undefined;
  embeddings_protocol?: string | null | undefined;
  video_protocol?: string | null | undefined;
}): { text: boolean; image: boolean; audio: boolean; embeddings: boolean; video: boolean } {
  return {
    text: val.text_protocol != null && val.text_protocol !== "",
    image: val.image_protocol != null && val.image_protocol !== "",
    audio: val.audio_protocol != null && val.audio_protocol !== "",
    embeddings: val.embeddings_protocol != null && val.embeddings_protocol !== "",
    video: val.video_protocol != null && val.video_protocol !== "",
  };
}

/** 连接草稿归一：trim title；custom 缺 preset。不给非文本 custom 补文本协议。 */
export function normalizeConnectionRaw(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const src = raw;
  const out: Record<string, unknown> = { ...src };
  if (out.audio_protocol == null && typeof out.voice_protocol === "string") {
    out.audio_protocol = out.voice_protocol;
  }
  delete out.voice_protocol;
  delete out.backend;
  delete out.format;
  if (out.preset == null) out.preset = LLM_PRESET_CUSTOM;
  const title = normalizeOptionalTitle(out.title);
  if (title === undefined) delete out.title;
  else out.title = title;
  return out;
}

/** @deprecated 用 {@link normalizeConnectionRaw} */
export const normalizeLlmProviderRaw = normalizeConnectionRaw;

const connectionObjectSchema = z
  .object({
    title: z.string().min(1).optional(),
    preset: llmPresetIdSchema.default(LLM_PRESET_CUSTOM),
    custom_kind: customKindIdSchema.optional(),
    text_protocol: llmFormatIdSchema.optional(),
    image_protocol: imageProtocolIdSchema.nullable().optional(),
    audio_protocol: audioProtocolIdSchema.nullable().optional(),
    embeddings_protocol: embeddingsProtocolIdSchema.nullable().optional(),
    /** 占位；暂无实现枚举 */
    video_protocol: z.string().nullable().optional(),
    base_url: z.string().url().optional(),
    api_key: z.string().optional(),
    ...timeoutFieldsSchema,
  })
  .strict();

function refineConnection(val: z.infer<typeof connectionObjectSchema>, ctx: z.RefinementCtx): void {
  refineTimeouts(
    {
      ...(val.timeout_ms !== undefined ? { timeout_ms: val.timeout_ms } : {}),
      ...(val.connect_timeout_ms !== undefined
        ? { connect_timeout_ms: val.connect_timeout_ms }
        : {}),
      ...(val.first_byte_timeout_ms !== undefined
        ? { first_byte_timeout_ms: val.first_byte_timeout_ms }
        : {}),
      ...(val.idle_timeout_ms !== undefined ? { idle_timeout_ms: val.idle_timeout_ms } : {}),
    },
    ctx,
  );

  if (val.preset !== LLM_PRESET_CUSTOM) {
    if (val.custom_kind != null) {
      ctx.addIssue({
        code: "custom",
        path: ["custom_kind"],
        message: "builtin connection cannot set custom_kind",
      });
    }
    return;
  }

  if (val.custom_kind == null) {
    ctx.addIssue({
      code: "custom",
      path: ["custom_kind"],
      message: "custom connection requires custom_kind",
    });
    return;
  }

  const flags = protocolSet(val);
  const requireBaseUrl = () => {
    if (val.base_url == null || !val.base_url.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["base_url"],
        message: "custom connection requires base_url",
      });
    }
  };

  const onlyKind = (kind: CustomKindId) => {
    if (kind !== "text" && flags.text) {
      ctx.addIssue({
        code: "custom",
        path: ["text_protocol"],
        message: "custom connection may only set the protocol for custom_kind",
      });
    }
    if (kind !== "image" && flags.image) {
      ctx.addIssue({
        code: "custom",
        path: ["image_protocol"],
        message: "custom connection may only set the protocol for custom_kind",
      });
    }
    if (kind !== "audio" && flags.audio) {
      ctx.addIssue({
        code: "custom",
        path: ["audio_protocol"],
        message: "custom connection may only set the protocol for custom_kind",
      });
    }
    if (kind !== "embeddings" && flags.embeddings) {
      ctx.addIssue({
        code: "custom",
        path: ["embeddings_protocol"],
        message: "custom connection may only set the protocol for custom_kind",
      });
    }
    if (kind !== "video" && flags.video) {
      ctx.addIssue({
        code: "custom",
        path: ["video_protocol"],
        message: "custom connection may only set the protocol for custom_kind",
      });
    }
  };

  switch (val.custom_kind) {
    case "text":
      onlyKind("text");
      if (val.text_protocol == null) {
        ctx.addIssue({
          code: "custom",
          path: ["text_protocol"],
          message: "custom text connection requires text_protocol",
        });
      }
      requireBaseUrl();
      break;
    case "image":
      onlyKind("image");
      if (val.image_protocol == null) {
        ctx.addIssue({
          code: "custom",
          path: ["image_protocol"],
          message: "custom image connection requires image_protocol",
        });
      } else if (!isGenericImageProtocol(val.image_protocol)) {
        ctx.addIssue({
          code: "custom",
          path: ["image_protocol"],
          message: "custom image connection must use a generic protocol",
        });
      }
      requireBaseUrl();
      break;
    case "audio":
      onlyKind("audio");
      if (val.audio_protocol == null) {
        ctx.addIssue({
          code: "custom",
          path: ["audio_protocol"],
          message: "custom audio connection requires audio_protocol",
        });
      } else if (!isGenericAudioProtocol(val.audio_protocol)) {
        ctx.addIssue({
          code: "custom",
          path: ["audio_protocol"],
          message: "custom audio connection must use a generic protocol",
        });
      }
      requireBaseUrl();
      break;
    case "embeddings":
      onlyKind("embeddings");
      if (val.embeddings_protocol == null) {
        ctx.addIssue({
          code: "custom",
          path: ["embeddings_protocol"],
          message: "custom embeddings connection requires embeddings_protocol",
        });
      }
      requireBaseUrl();
      break;
    case "video":
      onlyKind("video");
      requireBaseUrl();
      break;
    default:
      break;
  }
}

export const connectionSchema = z.preprocess(
  normalizeConnectionRaw,
  connectionObjectSchema.superRefine(refineConnection),
);

/** @deprecated 用 {@link connectionSchema} */
export const llmProviderSchema = connectionSchema;

export const connectionLooseSchema = z.preprocess(
  normalizeConnectionRaw,
  z
    .object({
      title: z.string().optional(),
      preset: llmPresetIdSchema.optional(),
      custom_kind: customKindIdSchema.optional(),
      text_protocol: llmFormatIdSchema.optional(),
      image_protocol: imageProtocolIdSchema.nullable().optional(),
      audio_protocol: audioProtocolIdSchema.nullable().optional(),
      embeddings_protocol: embeddingsProtocolIdSchema.nullable().optional(),
      video_protocol: z.string().nullable().optional(),
      base_url: z.string().optional(),
      api_key: z.string().optional(),
      ...timeoutFieldsSchema,
    })
    .passthrough(),
);

/** @deprecated 用 {@link connectionLooseSchema} */
export const llmProviderLooseSchema = connectionLooseSchema;

export const connectionsConfigSchema = z.record(z.string(), connectionLooseSchema).default({});

export type ConnectionConfig = {
  title?: string | undefined;
  preset?: LlmPresetId | undefined;
  custom_kind?: CustomKindId | undefined;
  text_protocol?: TextProtocolId | undefined;
  image_protocol?: ImageProtocolId | null | undefined;
  audio_protocol?: AudioProtocolId | null | undefined;
  embeddings_protocol?: EmbeddingsProtocolId | null | undefined;
  video_protocol?: string | null | undefined;
  base_url?: string | undefined;
  api_key?: string | undefined;
  timeout_ms?: number | undefined;
  connect_timeout_ms?: number | undefined;
  first_byte_timeout_ms?: number | undefined;
  idle_timeout_ms?: number | undefined;
};

/** @deprecated 用 {@link ConnectionConfig} */
export type LlmProviderConfig = ConnectionConfig;

export function connectionConfigToContext(
  cfg: ConnectionConfig,
  baseUrl: string,
): Record<string, unknown> {
  return omitUndefined({
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey: cfg.api_key,
    timeoutMs: cfg.timeout_ms,
    connectTimeoutMs: cfg.connect_timeout_ms,
    firstByteTimeoutMs: cfg.first_byte_timeout_ms,
    idleTimeoutMs: cfg.idle_timeout_ms,
  });
}

/** @deprecated 用 {@link connectionConfigToContext} */
export const llmProviderConfigToContext = connectionConfigToContext;

export function getConnectionTextProtocol(cfg: ConnectionConfig): TextProtocolId | undefined {
  return cfg.text_protocol;
}

/** @deprecated 用 {@link getConnectionTextProtocol} */
export const getProviderTextProtocol = getConnectionTextProtocol;
