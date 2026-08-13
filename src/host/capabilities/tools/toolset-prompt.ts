import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { PROMPT_XML_TAGS, wrapPromptXml } from "@freeanima/host/core/hooks/prompt";

const TOOLSETS_INTRO =
  "The list below is the core ToolSet catalog only — not the full inventory. " +
  "ToolSets not listed here (domain features, MCP, remote/Outpost tools, etc.) can still be found with toolset_search, then loaded with toolset_load; unload non-default sets with toolset_unload.";

/** Inner ToolSet catalog body (intro + lines); fold wraps with `<toolsets>`. */
export function renderToolsetsBody(registry: ToolSetRegistry): string {
  const sets = registry
    .listToolSets()
    .filter((ts) => ts.visibility === "catalog")
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
