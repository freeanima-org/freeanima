import type { Context } from "cordis";

import { ensureRootContext } from "@freeanima/kernel";
import type { FeaturePluginModule } from "./plugin.ts";
import { getFeatureService, mountFeatureService } from "./service.ts";
import type { FeatureRpcHandler } from "./types.ts";

/**
 * Register feature plugins onto the process context.
 *
 * Imperative entry point used by boot / integration tests; the production
 * loader mounts the same plugins through `cordis.yml` instead.
 */
export function registerFeatures(plugins: readonly FeaturePluginModule[]): void {
  const ctx: Context = ensureRootContext();
  const features = mountFeatureService(ctx);
  for (const plugin of plugins) {
    features.provide(plugin.feature);
  }
}

export function getFeatureRpcHandler(method: string): FeatureRpcHandler | undefined {
  return getFeatureService()?.getHandler(method);
}

export function resetFeatureRegistryForTests(): void {
  getFeatureService()?.clear();
}
