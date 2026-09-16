import type { FeatureRouteBundle } from "@freeanima/shared/habitat-contract/route.ts";
import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

import type { RemoteToolsServerDeps } from "@freeanima/habitat/capabilities/outpost/transport/types.ts";

/** Habitat RPC method handler contributed by a feature. */
export type FeatureRpcHandler = (
  deps: RemoteToolsServerDeps,
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
