import { z } from "zod";
import { omitUndefined } from "@freeanima/host/core/util";

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
export const LLM_PRESET_CUSTOM = "custom";

export const LLM_PRESET_IDS = [
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENROUTER,
  LLM_PRESET_OPENCODE_GO,
  LLM_PRESET_CUSTOM,
] as const;

export type LlmPresetId = (typeof LLM_PRESET_IDS)[number];

const llmFormatIdSchema = z.enum(LLM_FORMAT_IDS);
const llmPresetIdSchema = z.enum(LLM_PRESET_IDS);

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

/** Migrate legacy `backend` → `format` and default `preset: custom`. */
export function normalizeLlmProviderRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  if (out.format == null && typeof out.backend === "string") {
    out.format = out.backend;
  }
  delete out.backend;
  if (out.preset == null) {
    out.preset = LLM_PRESET_CUSTOM;
  }
  // Legacy configs omitted format/backend → Chat Completions
  if (out.format == null && out.preset === LLM_PRESET_CUSTOM) {
    out.format = LLM_FORMAT_OPENAI_COMPATIBLE;
  }
  return out;
}

export const llmProviderSchema = z.preprocess(
  normalizeLlmProviderRaw,
  z
    .object({
      preset: llmPresetIdSchema.default(LLM_PRESET_CUSTOM),
      /** Required for `custom`; single-format presets may omit (filled from preset table). */
      format: llmFormatIdSchema.optional(),
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
      if (val.preset === LLM_PRESET_CUSTOM) {
        if (val.format == null) {
          ctx.addIssue({
            code: "custom",
            path: ["format"],
            message: "custom connection requires format",
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
    }),
);

export const llmRouteHopSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const llmProfileSchema = z.object({
  chain: z.array(llmRouteHopSchema).min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Loose provider shape for stored RuntimeConfig / UI drafts.
 * Accepts legacy `backend`; full validation runs at bind via {@link llmProviderSchema}.
 */
export const llmProviderLooseSchema = z.preprocess(
  normalizeLlmProviderRaw,
  z
    .object({
      preset: llmPresetIdSchema.optional(),
      format: llmFormatIdSchema.optional(),
      base_url: z.string().optional(),
      api_key: z.string().optional(),
      ...timeoutFieldsSchema,
    })
    .passthrough(),
);

/** 允许分 tab 增量保存：缺 profiles / providers 时给空对象 */
export const llmConfigSchema = z.object({
  default_profile: z.string().min(1).default("chat"),
  providers: z.record(z.string(), llmProviderLooseSchema).default({}),
  profiles: z.record(z.string(), llmProfileSchema).default({}),
});

/**
 * Connection config (TS). Allows legacy `backend` and omitted `preset` so fixtures /
 * incremental UI drafts type-check; runtime parse via {@link llmProviderSchema} normalizes.
 * Optional fields include `| undefined` for exactOptionalPropertyTypes + Zod output.
 */
export type LlmProviderConfig = {
  preset?: LlmPresetId | undefined;
  format?: LlmFormatId | undefined;
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
