import type { SapRequestContext } from "@freeanima/shared/sap-contract";

import type { SapServerDeps } from "../sap/types.ts";

/** Habitat RPC method handler registered by a feature plugin. */
export type FeatureRpcHandler = (
  deps: SapServerDeps,
  payload: unknown,
  ctx: SapRequestContext,
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
  /** @deprecated 0.9.3 后删除 — 请用 habitat */
  hub?: {
    rpc?: Record<string, FeatureRpcHandler>;
  };
};
