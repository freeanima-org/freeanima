import type { ToolSetRegistry } from "./toolset.ts";

export const TOOLS_DISCOVERY_NAMES = ["tools_list", "tools_load"] as const;

export const DEFAULT_SESSION_TOOL_NAMES = [
  ...TOOLS_DISCOVERY_NAMES,
  "memory_recall",
  "memory_remember",
  "sessions_search",
  "sessions_scroll",
  "skills_search",
  "skills_load",
] as const;

export type DefaultSessionToolName = (typeof DEFAULT_SESSION_TOOL_NAMES)[number];

/** Filter out names not yet in Registry (MCP disconnected, partial registry in tests) */
export function resolveDefaultSessionTools(registry: ToolSetRegistry): string[] {
  return DEFAULT_SESSION_TOOL_NAMES.filter((name) => registry.getTool(name) != null);
}
