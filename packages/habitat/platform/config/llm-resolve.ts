import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import { resolveValue } from "./resolve.ts";

/** Expand env/vault references in connections.*.api_key */
export async function resolveLlmProviderApiKeys(cfg: RuntimeConfig): Promise<RuntimeConfig> {
  const connections = cfg.connections;
  if (!connections) return cfg;

  const next: NonNullable<RuntimeConfig["connections"]> = {};
  for (const [id, provider] of Object.entries(connections)) {
    next[id] = {
      ...provider,
      ...(provider.api_key ? { api_key: await resolveValue(provider.api_key) } : {}),
    };
  }
  return {
    ...cfg,
    connections: next,
  };
}
