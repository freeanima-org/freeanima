import {
  getActiveRuntimeConfig,
  getProfileHopProviderId,
  registerCatalogContextWindowLookup,
} from "@freeanima/host/core/config";
import { getLlmRuntime } from "@freeanima/host/core/llm";
import { PROFILE_CHAT } from "@freeanima/host/core/provider";

/** Bind Provider catalog lookup for compression context_window fallback */
export function bindContextWindowLookup(): void {
  registerCatalogContextWindowLookup(async (model) => {
    try {
      const cfg = getActiveRuntimeConfig().data;
      const providerId = getProfileHopProviderId(cfg, PROFILE_CHAT);
      const info = await getLlmRuntime().providers.get(providerId).getModel(model);
      return info?.contextWindow ?? null;
    } catch {
      return null;
    }
  });
}
