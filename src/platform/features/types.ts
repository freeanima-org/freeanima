import type { RemoteToolsRequestContext } from "@freeanima/shared/rpc-contract";

import type { RemoteToolsServerDeps } from "../remote-tools/types.ts";

/** Habitat RPC method handler registered by a feature plugin. */
export type FeatureRpcHandler = (
  deps: RemoteToolsServerDeps,
  payload: unknown,
  ctx: RemoteToolsRequestContext,
) => Promise<unknown>;

export type FeatureShellRouteDef = {
  path: string;
  featureId: string;
  navLabel?: string;
};

export type FeaturePlugin = {
  id: string;
  shell?: {
    routes: readonly FeatureShellRouteDef[];
  };
  habitat: {
    rpc?: Record<string, FeatureRpcHandler>;
  };
};
