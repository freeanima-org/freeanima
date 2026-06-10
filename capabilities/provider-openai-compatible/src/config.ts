import { z } from "zod";
import type { ProviderSpec } from "@freeanima/engine-provider-llm";

export const OPENAI_COMPATIBLE_BACKEND_ID = "openai_compatible";

/** Schema when backend=openai_compatible in yaml `llm.providers.<id>` */
export const openAiCompatibleProviderConfigSchema = z
  .object({
    backend: z.literal(OPENAI_COMPATIBLE_BACKEND_ID),
    base_url: z.string().url(),
    api_key: z.string().min(1),
    timeout_ms: z.number().int().positive().optional(),
  })
  .strict();

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
    },
  };
}
