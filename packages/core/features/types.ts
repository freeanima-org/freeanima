import type { FeatureRouteBundle } from "@freeanima/shared/habitat-contract/route.ts";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

/**
 * Habitat RPC method handler contributed by a feature.
 *
 * `deps` 是组合根注入的运行时依赖（形状由各特性经
 * `asRouteDeps<T>()` 自行声明）——契约层不绑定具体实现类型，
 * 这样 features 不必反向 import server / capabilities 的类型。
 */
export type FeatureRpcHandler = (
  deps: unknown,
  payload: unknown,
  ctx: RemoteToolsRequestContext,
) => Promise<unknown>;

/**
 * What a feature plugin contributes to the Habitat process.
 *
 * `routes` is the preferred form (schema + handler from the feature routes
 * bundle); `rpc` stays for imperative/test contributions.
 */
export type FeatureContribution = {
  id: string;
  routes?: FeatureRouteBundle;
  rpc?: Record<string, FeatureRpcHandler>;
};

/** Minimal view of the `features` service that feature plugins need. */
export type FeatureRegistryPort = {
  provide(contribution: FeatureContribution): void;
  revoke(id: string): void;
};
