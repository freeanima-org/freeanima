export type { FeaturePlugin, FeatureRpcHandler, FeatureShellRouteDef } from "./types.ts";
export {
  getFeatureRpcHandler,
  listFeaturePlugins,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "./registry.ts";
export { builtinFeaturePlugins } from "./builtin-plugins.ts";
