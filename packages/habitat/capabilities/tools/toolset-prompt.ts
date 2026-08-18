import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { PROMPT_XML_TAGS, wrapPromptXml } from "@freeanima/habitat/core/hooks/prompt";

const TOOLSETS_INTRO =
  "Built-in ToolSets below. MCP/Outpost sets may also appear here or only via toolset_search " +
  "(depends on visibility). Load with toolset_load; unload non-default sets with toolset_unload.";

const CODING_HANDS_INTRO =
  "编码会话的工作区 FS/终端只用已 attach 的前哨 ToolSet（remote_coding_*）；" +
  "不要 toolset_load 栖息地本机 file / shell。";

export type RenderToolsetsBodyOpts = {
  allowedToolNames?: readonly string[] | null;
  extraIntro?: string;
};

/** Compact tool name list for catalog density (collapse shared prefixes). */
export function formatToolNamesForCatalog(names: readonly string[]): string {
  if (names.length === 0) return "";
  const sorted = [...names].toSorted();
  const byPrefix = new Map<string, string[]>();
  for (const name of sorted) {
    const idx = name.indexOf("_");
    const prefix = idx > 0 ? name.slice(0, idx) : name;
    const list = byPrefix.get(prefix) ?? [];
    list.push(name);
    byPrefix.set(prefix, list);
  }
  const parts: string[] = [];
  for (const [prefix, group] of [...byPrefix.entries()].toSorted((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (group.length >= 2) {
      parts.push(`${prefix}_*`);
    } else {
      parts.push(...group);
    }
  }
  return parts.join(", ");
}

/** Inner ToolSet catalog body (intro + lines); fold wraps with `<toolsets>`. */
export function renderToolsetsBody(
  registry: ToolSetRegistry,
  opts?: RenderToolsetsBodyOpts,
): string {
  const allowed = opts?.allowedToolNames ? new Set(opts.allowedToolNames) : null;
  const sets = registry
    .listToolSets()
    .filter((ts) => ts.visibility === "catalog")
    .toSorted((a, b) => a.name.localeCompare(b.name));
  const lines = sets.flatMap((ts) => {
    const full = registry.getToolSet(ts.name);
    const toolNames = (full?.tools.map((d) => d.name) ?? []).filter((n) =>
      allowed ? allowed.has(n) : true,
    );
    if (allowed && toolNames.length === 0) return [];
    const tools = formatToolNamesForCatalog(toolNames);
    const desc = ts.description.trim() || "(no description)";
    return [tools ? `- ${ts.name} — ${desc} · ${tools}` : `- ${ts.name} — ${desc}`];
  });
  if (lines.length === 0) return "";
  const intro = opts?.extraIntro?.trim()
    ? `${TOOLSETS_INTRO}\n${opts.extraIntro.trim()}`
    : TOOLSETS_INTRO;
  return `${intro}\n\n${lines.join("\n")}`;
}

export { CODING_HANDS_INTRO };

/** Fully wrapped ToolSets section (for callers outside systemPromptBuild fold). */
export function renderToolsetsSection(registry: ToolSetRegistry): string {
  const body = renderToolsetsBody(registry);
  if (!body) return "";
  return wrapPromptXml(PROMPT_XML_TAGS.toolsets, body);
}
