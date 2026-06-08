import type { NestConfig } from "./schemas/config.ts";
import { resolveValue } from "./resolve.ts";

/** 展开 llm.providers.*.api_key 中的 env/credential 引用 */
export async function resolveLlmProviderApiKeys(cfg: NestConfig): Promise<NestConfig> {
  const providers: NestConfig["llm"]["providers"] = {};
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
