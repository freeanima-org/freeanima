import type { SapMethod, SapRequestContext, SapRouterOutputs } from "@freeanima/sap-contract";

import type { SapServerDeps } from "../sap/types.ts";

/** Hub RPC method handler registered by a feature plugin. */
export type FeatureRpcHandler = (
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) => Promise<SapRouterOutputs[SapMethod]>;

/** HTTP route registration hook (console / transitional REST). */
export type FeatureHttpRegistrar = (register: FeatureHttpRouteRegistrar) => void;

export type FeatureHttpRouteRegistrar = {
  /** Reserved for Phase 3 console migration; no-op until used. */
  mount: (prefix: string, setup: () => void) => void;
};

export type FeatureShellRouteDef = {
  path: string;
  /** Stable feature id for nav grouping. */
  featureId: string;
  navLabel?: string;
};

/** Shell routes are resolved in shell-ui; platform plugins may omit shell. */
export type FeaturePlugin = {
  id: string;
  shell?: {
    routes: readonly FeatureShellRouteDef[];
  };
  hub: {
    /** Hub RPC methods owned by this feature. */
    rpc?: Partial<Record<SapMethod, FeatureRpcHandler>>;
    registerHttp?: FeatureHttpRegistrar;
  };
};
