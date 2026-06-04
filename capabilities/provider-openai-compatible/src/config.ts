import { z } from "zod";
import type { ProviderSpec } from "@freeanima/engine-provider-llm";

export const OPENAI_COMPATIBLE_BACKEND_ID = "openai_compatible";

/** yaml `llm.providers.<id>` 中 backend=openai_compatible 时的 schema */
export const openAiCompatibleProviderConfigSchema = z
  .object({
    backend: z.literal(OPENAI_COMPATIBLE_BACKEND_ID),
    base_url: z.string().url(),
    api_key: z.string().min(1),
    timeout_ms: z.number().int().positive().optional(),
  })
  .strict();

export type OpenAiCompatibleProviderConfig = z.infer<typeof openAiCompatibleProviderConfigSchema>;

/** 解析为 engine-provider-llm 的 ProviderSpec（id 由 yaml key 传入） */
export function parseOpenAiCompatibleProviderSpec(
  id: string,
  raw: unknown,
): ProviderSpec {
  const cfg = openAiCompatibleProviderConfigSchema.parse(raw);
  return {
    id,
    backendId: OPENAI_COMPATIBLE_BACKEND_ID,
    context: {
      baseUrl: cfg.base_url.replace(/\/$/, ""),
      apiKey: cfg.api_key,
      ...(cfg.timeout_ms !== undefined ? { timeoutMs: cfg.timeout_ms } : {}),
    },
  };
}
