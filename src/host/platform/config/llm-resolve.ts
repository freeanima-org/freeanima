import type { AnimaConfig } from "@freeanima/host/core/config";
import { resolveValue } from "./resolve.ts";

/** Expand env/vault references in llm.providers.*.api_key */
export async function resolveLlmProviderApiKeys(cfg: AnimaConfig): Promise<AnimaConfig> {
  const llm = cfg.llm;
  if (!llm?.providers) return cfg;

  const providers: AnimaConfig["llm"]["providers"] = {};
  for (const [id, provider] of Object.entries(llm.providers)) {
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
