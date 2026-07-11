import type { z } from "zod";

import type { HubRouteHandler } from "@freeanima/shared/hub-contract/route.ts";

import type { FeatureRpcHandler } from "../features/types.ts";
import type { SapServerDeps } from "../sap/types.ts";

type AnyHubRouteHandler = HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;

/** Hub route handler → FeatureRpcHandler（hubDispatch 已 parse input） */
export function toFeatureRpcHandler(handler: AnyHubRouteHandler): FeatureRpcHandler {
  return (deps: SapServerDeps, payload: unknown, ctx) => handler(deps, payload, ctx);
}

export function toFeatureRpcHandlerMap(
  handlers: Record<string, AnyHubRouteHandler>,
): Record<string, FeatureRpcHandler> {
  const out: Record<string, FeatureRpcHandler> = {};
  for (const [method, handler] of Object.entries(handlers)) {
    out[method] = toFeatureRpcHandler(handler);
  }
  return out;
}
