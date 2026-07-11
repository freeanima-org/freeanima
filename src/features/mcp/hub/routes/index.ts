import { z } from "zod";

import { dualTransportMeta } from "@freeanima/shared/hub-contract";
import { defineHubRoute, mergeFeatureRoutes } from "@freeanima/shared/hub-contract/route.ts";
import {
  getMcpStatus,
  mcpStartAll,
  mcpStartServer,
  mcpStopAll,
  mcpStopServer,
} from "@freeanima/features/console/hub/console-api/handlers/mcp.ts";

const emptyInputSchema = z.object({}).strict();
const mcpServerNameInputSchema = z.object({ name: z.string().min(1) });
const unknownOutputSchema = z.record(z.string(), z.unknown());

export const mcpHubRoutes = mergeFeatureRoutes([
  defineHubRoute({
    method: "mcp.status",
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(true),
    handler: async () => getMcpStatus(),
  }),
  defineHubRoute({
    method: "mcp.startAll",
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
    handler: async () => mcpStartAll(),
  }),
  defineHubRoute({
    method: "mcp.stopAll",
    input: emptyInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
    handler: async () => mcpStopAll(),
  }),
  defineHubRoute({
    method: "mcp.startServer",
    input: mcpServerNameInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) => mcpStartServer(input.name),
  }),
  defineHubRoute({
    method: "mcp.stopServer",
    input: mcpServerNameInputSchema,
    output: unknownOutputSchema,
    meta: dualTransportMeta(false),
    handler: async (_deps, input) => mcpStopServer(input.name),
  }),
]);
