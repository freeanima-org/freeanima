import type { ToolDef } from "@freeanima/habitat/core/tool";
import { toolError, toolResult } from "@freeanima/habitat/core/tool";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { coerceString } from "@freeanima/shared/coerce-string";

import { createEmbeddedMemoryService } from "./service/index.ts";

/**
 * MCP 暴露的 MemoryService 运维/评测子集（#16102 PR4）。
 */
export const memoryServiceMcpToolDefs: ToolDef[] = [
  {
    name: "memory_service_recall",
    description: "Recall memories via MemoryService (scope: semantic|temporal).",
    exposeMcp: true,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        scope: { type: "string", enum: ["semantic", "temporal"] },
        limit: { type: "number" },
      },
      required: ["query"],
    },
    handler: async (args) => {
      const query = coerceString(args.query).trim();
      if (!query) return toolError("query is required");
      const scope = coerceString(args.scope).trim() === "temporal" ? "temporal" : "semantic";
      const limit = args.limit != null ? Number(args.limit) : 10;
      try {
        const result = await createEmbeddedMemoryService().recall({ query, scope, limit });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
  {
    name: "memory_service_list",
    description: "List semantic memories via MemoryService.",
    exposeMcp: true,
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" },
        status: { type: "string", enum: ["active", "deprecated", "all"] },
      },
    },
    handler: async (args) => {
      try {
        const status =
          args.status === "deprecated" || args.status === "all" ? args.status : "active";
        const items = await createEmbeddedMemoryService().list({
          limit: args.limit != null ? Number(args.limit) : 50,
          status,
        });
        return toolResult({ items });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
  {
    name: "memory_service_get",
    description: "Get one semantic memory by id via MemoryService.",
    exposeMcp: true,
    parameters: {
      type: "object",
      properties: { id: { type: "number" } },
      required: ["id"],
    },
    handler: async (args) => {
      const id = Number(args.id);
      if (!Number.isInteger(id) || id <= 0) return toolError("id must be a positive integer");
      try {
        const item = await createEmbeddedMemoryService().get(id);
        return toolResult({ item });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    },
  },
];

export function registerMemoryServiceMcpTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "memory_service",
    "MemoryService MCP surface (#16102)",
    memoryServiceMcpToolDefs,
    { visibility: "searchable" },
  );
}
