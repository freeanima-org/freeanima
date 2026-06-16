import type { SessionMetaMessage } from "@freeanima/core/db/domain";
import { applySessionToolMaskFilter } from "./mask-port.ts";
import { toolNamesForToolsets } from "./toolset-meta.ts";
import type { ToolSetRegistry } from "./toolset.ts";

export const TOOLSETS_DISCOVERY_TOOLSET = "toolsets" as const;

export const DEFAULT_SESSION_TOOLSETS = [
  TOOLSETS_DISCOVERY_TOOLSET,
  "memory",
  "sessions",
  "skills",
] as const;

export type DefaultSessionToolsetName = (typeof DEFAULT_SESSION_TOOLSETS)[number];

/** Filter out ToolSets not yet in Registry (MCP disconnected, partial registry in tests) */
export function resolveDefaultSessionToolsets(registry: ToolSetRegistry): string[] {
  return DEFAULT_SESSION_TOOLSETS.filter((name) => registry.getToolSet(name) != null);
}

/** Keep ToolSets that expose at least one allowed tool name */
export function filterToolsetsByAllowedTools(
  registry: ToolSetRegistry,
  toolsetNames: readonly string[],
  allowedToolNames: readonly string[],
): string[] {
  const allowed = new Set(allowedToolNames);
  return toolsetNames.filter((ts) =>
    toolNamesForToolsets(registry, [ts]).some((name) => allowed.has(name)),
  );
}

/** Default session ToolSets filtered by session capability mask (when configured) */
export function resolveDefaultSessionToolsetsForMeta(
  registry: ToolSetRegistry,
  meta: SessionMetaMessage,
): string[] {
  const defaults = resolveDefaultSessionToolsets(registry);
  const allowed = applySessionToolMaskFilter(toolNamesForToolsets(registry, defaults), meta);
  return filterToolsetsByAllowedTools(registry, defaults, allowed);
}
