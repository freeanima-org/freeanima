import {
  getActiveRuntimeConfig,
  getProfileHopProviderId,
  registerCatalogContextWindowLookup,
} from "@freeanima/core/config";
import { getLlmRuntime } from "@freeanima/core/llm";
import { PROFILE_CHAT } from "@freeanima/core/provider";

/** Wire Provider catalog lookup for compression context_window fallback */
export function wireContextWindowLookup(): void {
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
