import type { ToolSetRegistry } from "@freeanima/core/tool";

const PROMPT_CODE_FENCE_LANG = "md";

const TOOLSETS_FRAME =
  "Built-in and connected ToolSets are listed below. Load any set with toolset_load. For dynamically registered tools (MCP/ACP/Outpost) whose names you don't know, use toolset_search first to find the ToolSet, then load it.";

function wrapPromptSection(heading: string, inner: string, frame?: string): string {
  const body = inner.trim();
  if (!body) return "";
  const header = frame ? `${frame.trim()}\n\n## ${heading}` : `## ${heading}`;
  return `${header}\n\`\`\`${PROMPT_CODE_FENCE_LANG}\n${body}\n\`\`\``;
}

/** Render ToolSet name + description index for system prompt */
export function renderToolsetsSection(registry: ToolSetRegistry): string {
  const sets = registry
    .listToolSets()
    .filter((ts) => !ts.private)
    .toSorted((a, b) => a.name.localeCompare(b.name));
  if (sets.length === 0) return "";
  const lines = sets.map((ts) => `- ${ts.name} — ${ts.description.trim() || "(no description)"}`);
  return wrapPromptSection("ToolSets", lines.join("\n"), TOOLSETS_FRAME);
}
