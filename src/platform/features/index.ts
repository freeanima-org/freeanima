export type {
  FeatureHttpRegistrar,
  FeatureHttpRouteRegistrar,
  FeaturePlugin,
  FeatureRpcHandler,
  FeatureShellRouteDef,
} from "./types.ts";
export {
  applyFeatureHttpRegistrations,
  getFeatureRpcHandler,
  listFeaturePlugins,
  registerFeatures,
  resetFeatureRegistryForTests,
} from "./registry.ts";
export { mountFeatureHttpRoutes } from "./http-registry.ts";
export { builtinFeaturePlugins } from "./builtin-plugins.ts";
