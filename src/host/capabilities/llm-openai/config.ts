import { z } from "zod";
import type { ProviderSpec } from "@freeanima/host/core/provider";

export const OPENAI_COMPATIBLE_BACKEND_ID = "openai_compatible";

/** Schema when backend=openai_compatible in yaml `llm.providers.<id>` */
export const openAiCompatibleProviderConfigSchema = z
  .object({
    backend: z.literal(OPENAI_COMPATIBLE_BACKEND_ID),
    base_url: z.string().url(),
    api_key: z.string().min(1),
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

export type OpenAiCompatibleProviderConfig = z.infer<typeof openAiCompatibleProviderConfigSchema>;

/** Parse as engine-provider-llm ProviderSpec (id from yaml key) */
export function parseOpenAiCompatibleProviderSpec(id: string, raw: unknown): ProviderSpec {
  const cfg = openAiCompatibleProviderConfigSchema.parse(raw);
  return {
    id,
    backendId: OPENAI_COMPATIBLE_BACKEND_ID,
    context: {
      baseUrl: cfg.base_url.replace(/\/$/, ""),
      apiKey: cfg.api_key,
      ...(cfg.timeout_ms !== undefined ? { timeoutMs: cfg.timeout_ms } : {}),
      ...(cfg.first_byte_timeout_ms !== undefined
        ? { firstByteTimeoutMs: cfg.first_byte_timeout_ms }
        : {}),
      ...(cfg.idle_timeout_ms !== undefined ? { idleTimeoutMs: cfg.idle_timeout_ms } : {}),
    },
  };
}
