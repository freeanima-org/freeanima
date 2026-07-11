import type { z } from "zod";

import {
  attachHandlersToDefs,
  type HubRouteHandler,
} from "@freeanima/shared/hub-contract/route.ts";
import { mcpMethodDefs } from "@freeanima/shared/hub-contract/registry/mcp.ts";

import { consoleHubHandlers } from "@freeanima/features/console/hub/console-api/console-hub-handlers.ts";

type AnyHubRouteHandler = HubRouteHandler<z.ZodTypeAny, z.ZodTypeAny>;

function wrapConsoleLegacyHandler(
  fn: (payload: unknown) => Promise<unknown> | unknown,
): AnyHubRouteHandler {
  return (_deps: unknown, input: unknown, _ctx: unknown) => Promise.resolve(fn(input));
}

export const mcpHubRoutes = attachHandlersToDefs(mcpMethodDefs, {
  "mcp.status": wrapConsoleLegacyHandler(consoleHubHandlers["mcp.status"]),
  "mcp.startAll": wrapConsoleLegacyHandler(consoleHubHandlers["mcp.startAll"]),
  "mcp.stopAll": wrapConsoleLegacyHandler(consoleHubHandlers["mcp.stopAll"]),
  "mcp.startServer": wrapConsoleLegacyHandler(
    consoleHubHandlers["mcp.startServer"] as (payload: unknown) => Promise<unknown>,
  ),
  "mcp.stopServer": wrapConsoleLegacyHandler(
    consoleHubHandlers["mcp.stopServer"] as (payload: unknown) => Promise<unknown>,
  ),
} as Record<keyof typeof mcpMethodDefs, AnyHubRouteHandler>);
