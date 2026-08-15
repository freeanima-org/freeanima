import {
  getActiveRuntimeConfig,
  getProfileHopProviderId,
  registerCatalogContextWindowLookup,
} from "@freeanima/habitat/core/config";
import { getLlmRuntime } from "@freeanima/habitat/core/llm";
import { PROFILE_CHAT } from "@freeanima/habitat/core/provider";

/** Bind Provider catalog lookup for compression context_window */
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
