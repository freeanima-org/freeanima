import type { z } from "zod";

import type { HubRouteHandler } from "@freeanima/shared/habitat-contract/route.ts";

import type { FeatureRpcHandler } from "../features/types.ts";
import type { RemoteToolsServerDeps } from "../remote-tools/types.ts";

type AnyHubRouteHandler = HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;

/** Habitat route handler → FeatureRpcHandler（habitatDispatch 已 parse input） */
export function toFeatureRpcHandler(handler: AnyHubRouteHandler): FeatureRpcHandler {
  return (deps: RemoteToolsServerDeps, payload: unknown, ctx) => handler(deps, payload, ctx);
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
