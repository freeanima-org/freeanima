import { z } from "zod";

import { defineHubMethod, httpOnlyMeta } from "../method-def.ts";

const emptyInputSchema = z.object({}).strict();
const mcpServerNameInputSchema = z.object({ name: z.string().min(1) });
const unknownOutputSchema = z.record(z.string(), z.unknown());

/** MCP 管控 API（`/mcp` 协议端点本身不进 registry） */
export const mcpMethodDefs = {
  "mcp.status": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "GET", path: "/api/mcp/status" }),
  }),
  "mcp.startAll": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/mcp/start-all" }),
  }),
  "mcp.stopAll": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/mcp/stop-all" }),
  }),
  "mcp.startServer": defineHubMethod({
    input: mcpServerNameInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/mcp/{name}/start" }),
  }),
  "mcp.stopServer": defineHubMethod({
    input: mcpServerNameInputSchema,
    output: unknownOutputSchema,
    meta: httpOnlyMeta({ method: "POST", path: "/api/mcp/{name}/stop" }),
  }),
} as const;
