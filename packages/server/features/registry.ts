import type { Context } from "cordis";

import type { FeaturePluginModule } from "@freeanima/core/features/plugin.ts";
import { serviceRootContext } from "../bootstrap/kernel.ts";
import { getFeatureService, mountFeatureService } from "./service.ts";

/**
 * Register feature plugins onto the composition-root context.
 *
 * Imperative entry point used by boot / integration tests; the production
 * loader mounts the same plugins through `cordis.yml` instead.
 */
export function registerFeatures(
  plugins: readonly FeaturePluginModule[],
  ctx: Context = serviceRootContext(),
): void {
  const features = mountFeatureService(ctx);
  for (const plugin of plugins) {
    features.provide(plugin.feature);
  }
}

export { getFeatureRpcHandler } from "@freeanima/core/features/registry.ts";

export function resetFeatureRegistryForTests(): void {
  getFeatureService()?.clear();
}
