import { z } from "zod";

export const OPENAI_COMPATIBLE_BACKEND_ID = "openai_compatible";

export const llmProviderOpenAiSchema = z
  .object({
    backend: z.literal(OPENAI_COMPATIBLE_BACKEND_ID).default(OPENAI_COMPATIBLE_BACKEND_ID),
    base_url: z.string().url(),
    api_key: z.string().optional(),
    /** 整体墙钟超时（ms） */
    timeout_ms: z.number().int().positive().optional(),
    /** 首字节超时（ms）；须 ≤ timeout_ms */
    first_byte_timeout_ms: z.number().int().positive().optional(),
    /** 流式 chunk idle（ms）；须 ≤ timeout_ms */
    idle_timeout_ms: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
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
  });

export const llmRouteHopSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const llmProfileSchema = z.object({
  chain: z.array(llmRouteHopSchema).min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

/** 允许分 tab 增量保存：缺 profiles / providers 时给空对象，backend 默认 openai_compatible */
export const llmConfigSchema = z.object({
  default_profile: z.string().min(1).default("chat"),
  providers: z.record(z.string(), llmProviderOpenAiSchema).default({}),
  profiles: z.record(z.string(), llmProfileSchema).default({}),
});

export type LlmConfig = z.infer<typeof llmConfigSchema>;
export type LlmProviderOpenAiConfig = z.infer<typeof llmProviderOpenAiSchema>;
export type LlmProfileConfig = z.infer<typeof llmProfileSchema>;
export type LlmRouteHopConfig = z.infer<typeof llmRouteHopSchema>;
