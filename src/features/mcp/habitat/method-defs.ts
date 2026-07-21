import { z } from "zod";

import { defineHabitatMethod, dualTransportMeta } from "@freeanima/shared/habitat-contract";

const emptyInputSchema = z.object({}).strict();
const mcpServerNameInputSchema = z.object({ name: z.string().min(1) });
const unknownOutputSchema = z.record(z.string(), z.unknown());

/** MCP 管控 API（`/mcp` 协议端点本身不进 registry） */
export const mcpMethodDefs = {
  "mcp.status": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
  }),
  "mcp.startAll": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "mcp.stopAll": defineHabitatMethod({
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "mcp.startServer": defineHabitatMethod({
    input: mcpServerNameInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
  "mcp.stopServer": defineHabitatMethod({
    input: mcpServerNameInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
  }),
} as const;
