export type { FeatureContribution, FeatureRpcHandler } from "@freeanima/core/features/types.ts";
export { FeatureService, getFeatureService, mountFeatureService } from "./service.ts";
export { createFeaturePlugin, type FeaturePluginModule } from "@freeanima/core/features/plugin.ts";
export {
  getFeatureRpcHandler,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "./registry.ts";
export { builtinFeaturePlugins } from "./builtin-feature-plugins.ts";
