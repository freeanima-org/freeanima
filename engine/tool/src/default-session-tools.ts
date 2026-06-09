import type { ToolSetRegistry } from "./toolset.ts";

export const CATALOG_TOOL_NAMES = ["tool_search", "tool_load"] as const;

export const DEFAULT_SESSION_TOOL_NAMES = [
  ...CATALOG_TOOL_NAMES,
  "recall",
  "remember",
  "search_skills",
  "load_skill",
] as const;

export type DefaultSessionToolName = (typeof DEFAULT_SESSION_TOOL_NAMES)[number];

/** 过滤掉 Registry 中尚不存在的名（MCP 未连、测试 partial registry） */
export function resolveDefaultSessionTools(registry: ToolSetRegistry): string[] {
  return DEFAULT_SESSION_TOOL_NAMES.filter((name) => registry.getTool(name) != null);
}
