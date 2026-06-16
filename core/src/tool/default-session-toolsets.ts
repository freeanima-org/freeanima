import type { SessionMetaMessage } from "@freeanima/core/db/domain";
import { applySessionToolMaskFilter } from "./mask-port.ts";
import { toolNamesForToolSets } from "./toolset-meta.ts";
import type { ToolSetRegistry } from "./toolset.ts";

export const TOOL_SET_DISCOVERY_TOOL_SET = "toolset" as const;

export const DEFAULT_SESSION_TOOLSETS = [TOOL_SET_DISCOVERY_TOOL_SET, "memory"] as const;

export type DefaultSessionToolSetName = (typeof DEFAULT_SESSION_TOOLSETS)[number];

/** Filter out ToolSets not yet in Registry (MCP disconnected, partial registry in tests) */
export function resolveDefaultSessionToolSets(registry: ToolSetRegistry): string[] {
  return DEFAULT_SESSION_TOOLSETS.filter((name) => registry.getToolSet(name) != null);
}

/** Keep ToolSets that expose at least one allowed tool name */
export function filterToolSetsByAllowedTools(
  registry: ToolSetRegistry,
  toolsetNames: readonly string[],
  allowedToolNames: readonly string[],
): string[] {
  const allowed = new Set(allowedToolNames);
  return toolsetNames.filter((ts) =>
    toolNamesForToolSets(registry, [ts]).some((name) => allowed.has(name)),
  );
}

/** Default session ToolSets filtered by session capability mask (when configured) */
export function resolveDefaultSessionToolSetsForMeta(
  registry: ToolSetRegistry,
  meta: SessionMetaMessage,
): string[] {
  const defaults = resolveDefaultSessionToolSets(registry);
  const allowed = applySessionToolMaskFilter(toolNamesForToolSets(registry, defaults), meta);
  return filterToolSetsByAllowedTools(registry, defaults, allowed);
}
