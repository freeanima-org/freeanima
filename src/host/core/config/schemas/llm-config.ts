import { z } from "zod";

export const OPENAI_COMPATIBLE_BACKEND_ID = "openai_compatible";

export const llmProviderOpenAiSchema = z
  .object({
    backend: z.literal(OPENAI_COMPATIBLE_BACKEND_ID).default(OPENAI_COMPATIBLE_BACKEND_ID),
    base_url: z.string().url(),
    api_key: z.string().optional(),
    timeout_ms: z.number().int().positive().optional(),
  })
  .strict();

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
