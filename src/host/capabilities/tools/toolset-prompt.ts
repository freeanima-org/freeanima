import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { PROMPT_XML_TAGS, wrapPromptXml } from "@freeanima/host/core/hooks/prompt";

const TOOLSETS_INTRO =
  "Built-in and connected ToolSets are listed below. Load any set with toolset_load; unload non-default sets with toolset_unload. For dynamically registered tools (MCP/ACP/Outpost) whose names you don't know, use toolset_search first to find the ToolSet, then load it.";

/** Inner ToolSet catalog body (intro + lines); fold wraps with `<toolsets>`. */
export function renderToolsetsBody(registry: ToolSetRegistry): string {
  const sets = registry
    .listToolSets()
    .filter((ts) => !ts.private)
    .toSorted((a, b) => a.name.localeCompare(b.name));
  if (sets.length === 0) return "";
  const lines = sets.map((ts) => `- ${ts.name} — ${ts.description.trim() || "(no description)"}`);
  return `${TOOLSETS_INTRO}\n\n${lines.join("\n")}`;
}

/** Fully wrapped ToolSets section (for callers outside systemPromptBuild fold). */
export function renderToolsetsSection(registry: ToolSetRegistry): string {
  const body = renderToolsetsBody(registry);
  if (!body) return "";
  return wrapPromptXml(PROMPT_XML_TAGS.toolsets, body);
}
