import { bindHubRouteHandlers } from "@freeanima/shared/hub-contract/route.ts";
import {
  getMcpStatus,
  mcpStartAll,
  mcpStartServer,
  mcpStopAll,
  mcpStopServer,
} from "@freeanima/features/console/hub/console-api/handlers/mcp.ts";

import { mcpMethodDefs } from "../method-defs.ts";

export const mcpHubRoutes = bindHubRouteHandlers(mcpMethodDefs, {
  "mcp.status": async () => getMcpStatus(),
  "mcp.startAll": async () => mcpStartAll(),
  "mcp.stopAll": async () => mcpStopAll(),
  "mcp.startServer": async (_deps, input) => mcpStartServer(input.name),
  "mcp.stopServer": async (_deps, input) => mcpStopServer(input.name),
});
