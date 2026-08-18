import type { ProviderSpec } from "@freeanima/habitat/core/provider";
import {
  connectionSchema,
  type ConnectionConfig,
} from "@freeanima/habitat/core/config/schemas/llm-config.ts";
import { providerConfigToSpec } from "@freeanima/habitat/core/llm/presets";

/** @deprecated Prefer {@link connectionSchema} + {@link providerConfigToSpec} */
export const openAiCompatibleProviderConfigSchema = connectionSchema;

export type OpenAiCompatibleProviderConfig = ConnectionConfig;

/** Parse as ProviderSpec (id from yaml key); requires api_key. */
export function parseOpenAiCompatibleProviderSpec(id: string, raw: unknown): ProviderSpec {
  const cfg = connectionSchema.parse(raw);
  if (!cfg.api_key?.trim()) {
    throw new Error(`connections.${id}.api_key is required`);
  }
  return providerConfigToSpec(id, cfg);
}
