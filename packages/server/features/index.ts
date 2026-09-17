export type { FeatureContribution, FeatureRpcHandler } from "./types.ts";
export { FeatureService, getFeatureService, mountFeatureService } from "./service.ts";
export { createFeaturePlugin, type FeaturePluginModule } from "./plugin.ts";
export {
  getFeatureRpcHandler,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "./registry.ts";
export { builtinFeaturePlugins } from "./builtin-feature-plugins.ts";
