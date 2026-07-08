import type { SapRequestContext } from "@freeanima/sap-contract";

import type { SapServerDeps } from "../sap/types.ts";

/** Hub RPC method handler registered by a feature plugin. */
export type FeatureRpcHandler = (
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
) => Promise<unknown>;

/** HTTP route registration hook (legacy; health/tts only). */
export type FeatureHttpRegistrar = (register: FeatureHttpRouteRegistrar) => void;

export type FeatureHttpRouteRegistrar = {
  mount: (prefix: string, setup: () => void) => void;
};

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
  hub: {
    rpc?: Record<string, FeatureRpcHandler>;
    registerHttp?: FeatureHttpRegistrar;
  };
};
