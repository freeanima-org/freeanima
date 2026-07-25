import type { RuntimeConfig } from "@freeanima/host/core/config";
import { resolveValue } from "./resolve.ts";

/** Expand env/vault references in llm.providers.*.api_key */
export async function resolveLlmProviderApiKeys(cfg: RuntimeConfig): Promise<RuntimeConfig> {
  const llm = cfg.llm;
  if (!llm?.providers) return cfg;

  const providers: NonNullable<RuntimeConfig["llm"]>["providers"] = {};
  for (const [id, provider] of Object.entries(llm.providers)) {
    providers[id] = {
      ...provider,
      ...(provider.api_key ? { api_key: await resolveValue(provider.api_key) } : {}),
    };
  }
  return {
    ...cfg,
    llm: {
      ...llm,
      providers,
    },
  };
}
