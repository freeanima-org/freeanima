import type { ToolSetRegistry } from "@freeanima/mechanism-tool";

const PROMPT_CODE_FENCE_LANG = "md";

const TOOLSETS_FRAME =
  "Registered ToolSets are listed below. Use tools_list (optional toolset / keyword filters) for concrete tool names, then tools_load for full schema.";

function wrapPromptSection(heading: string, inner: string, frame?: string): string {
  const body = inner.trim();
  if (!body) return "";
  const header = frame ? `${frame.trim()}\n\n## ${heading}` : `## ${heading}`;
  return `${header}\n\`\`\`${PROMPT_CODE_FENCE_LANG}\n${body}\n\`\`\``;
}

/** Render ToolSet name + description index for system prompt */
export function renderToolsetsSection(registry: ToolSetRegistry): string {
  const sets = registry.listToolSets().toSorted((a, b) => a.name.localeCompare(b.name));
  if (!sets.length) return "";
  const lines = sets.map((ts) => `### ${ts.name}\n${ts.description.trim() || "(no description)"}`);
  return wrapPromptSection("ToolSets", lines.join("\n\n"), TOOLSETS_FRAME);
}
