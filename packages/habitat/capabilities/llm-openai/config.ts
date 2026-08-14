import type { ProviderSpec } from "@freeanima/habitat/core/provider";
import {
  llmProviderSchema,
  type LlmProviderConfig,
} from "@freeanima/habitat/core/config/schemas/llm-config.ts";
import { providerConfigToSpec } from "@freeanima/habitat/core/llm/presets";

/** @deprecated Prefer {@link llmProviderSchema} + {@link providerConfigToSpec} */
export const openAiCompatibleProviderConfigSchema = llmProviderSchema;

export type OpenAiCompatibleProviderConfig = LlmProviderConfig;

/** Parse as ProviderSpec (id from yaml key); requires api_key. */
export function parseOpenAiCompatibleProviderSpec(id: string, raw: unknown): ProviderSpec {
  const cfg = llmProviderSchema.parse(raw);
  if (!cfg.api_key?.trim()) {
    throw new Error(`llm.providers.${id}.api_key is required`);
  }
  return providerConfigToSpec(id, cfg);
}
