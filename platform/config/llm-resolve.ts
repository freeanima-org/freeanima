import type { AnimaConfig } from "@freeanima/core/config";
import { resolveValue } from "./resolve.ts";

/** Expand env/credential references in llm.providers.*.api_key */
export async function resolveLlmProviderApiKeys(cfg: AnimaConfig): Promise<AnimaConfig> {
  const providers: AnimaConfig["llm"]["providers"] = {};
  for (const [id, provider] of Object.entries(cfg.llm.providers)) {
    providers[id] = {
      ...provider,
      ...(provider.api_key ? { api_key: await resolveValue(provider.api_key) } : {}),
    };
  }
  return {
    ...cfg,
    llm: {
      ...cfg.llm,
      providers,
    },
  };
}
