import type { ConversationMetaMessage } from "@freeanima/habitat/core/db/domain";
import { applyConversationToolPolicyFilter } from "./policy-port.ts";
import { toolNamesForToolSets } from "./toolset-meta.ts";
import type { ToolSetRegistry } from "./toolset.ts";

export const TOOL_SET_DISCOVERY_TOOL_SET = "toolset" as const;

export const DEFAULT_CONVERSATION_TOOLSETS = [
  TOOL_SET_DISCOVERY_TOOL_SET,
  "memory",
  "notification",
  "skill",
  "subagent",
  "workflow",
] as const;

export type DefaultConversationToolSetName = (typeof DEFAULT_CONVERSATION_TOOLSETS)[number];

/** Filter out ToolSets not yet in Registry (MCP disconnected, partial registry in tests) */
export function resolveDefaultConversationToolSets(registry: ToolSetRegistry): string[] {
  return DEFAULT_CONVERSATION_TOOLSETS.filter((name) => registry.getToolSet(name) != null);
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

/** Default conversation ToolSets filtered by conversation capability mask (when configured) */
export function resolveDefaultConversationToolSetsForMeta(
  registry: ToolSetRegistry,
  meta: ConversationMetaMessage,
): string[] {
  const defaults = resolveDefaultConversationToolSets(registry);
  const allowed = applyConversationToolPolicyFilter(toolNamesForToolSets(registry, defaults), meta);
  return filterToolSetsByAllowedTools(registry, defaults, allowed);
}
