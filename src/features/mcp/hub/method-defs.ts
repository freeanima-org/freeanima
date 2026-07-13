import { z } from "zod";

import { defineHubMethod, dualTransportMeta } from "@freeanima/shared/hub-contract";

const emptyInputSchema = z.object({}).strict();
const mcpServerNameInputSchema = z.object({ name: z.string().min(1) });
const unknownOutputSchema = z.record(z.string(), z.unknown());

/** MCP 管控 API（`/mcp` 协议端点本身不进 registry） */
export const mcpMethodDefs = {
  "mcp.status": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "mcp.startAll": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "mcp.stopAll": defineHubMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "mcp.startServer": defineHubMethod({
    input: mcpServerNameInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "mcp.stopServer": defineHubMethod({
    input: mcpServerNameInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
