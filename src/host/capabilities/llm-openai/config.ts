import type { ProviderSpec } from "@freeanima/host/core/provider";
import {
  LLM_FORMAT_OPENAI_COMPATIBLE,
  llmProviderSchema,
  type LlmProviderConfig,
} from "@freeanima/host/core/config/schemas/llm-config.ts";
import { providerConfigToSpec } from "@freeanima/host/core/llm/presets";

/** @deprecated Prefer {@link LLM_FORMAT_OPENAI_COMPATIBLE} */
export const OPENAI_COMPATIBLE_BACKEND_ID = LLM_FORMAT_OPENAI_COMPATIBLE;

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
