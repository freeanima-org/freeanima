import type { ToolSetRegistry } from "./toolset.ts";

export const TOOL_SET_LOAD_TOOL_NAME = "toolset_load";
export const TOOL_SET_SEARCH_TOOL_NAME = "toolset_search";

/** Monolithic ToolSet names from before task/email split — expand when resolving cached meta */
const LEGACY_TOOLSET_EXPANSION: Record<string, readonly string[]> = {
  task: ["task", "tasklist"],
  email: ["email", "email-account"],
};

function expandLegacyToolSetNames(registry: ToolSetRegistry, toolset: string): string[] {
  const siblings = LEGACY_TOOLSET_EXPANSION[toolset];
  if (!siblings) return [toolset];
  const expanded = siblings.filter((name) => registry.getToolSet(name) != null);
  return expanded.length > 0 ? expanded : [toolset];
}

/** Resolve a registry tool name to its owning ToolSet */
export function toolSetForTool(registry: ToolSetRegistry, toolName: string): string | null {
  const trimmed = toolName.trim();
  if (!trimmed) return null;
  for (const ts of registry.listToolSets()) {
    if (ts.tools.includes(trimmed)) return ts.name;
  }
  return null;
}

/** Merge ToolSet names preserving order, deduped */
export function mergeToolSetNames(current: readonly string[], toAdd: readonly string[]): string[] {
  const seen = new Set(current.map((n) => n.trim()).filter(Boolean));
  const out = current.map((n) => n.trim()).filter(Boolean);
  for (const raw of toAdd) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** Coerce legacy fine-grained tool names or ToolSet names into ToolSet names */
export function resolveToolSetNames(registry: ToolSetRegistry, names: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const item = raw.trim();
    if (!item) continue;
    let toolset = registry.getToolSet(item)?.name ?? null;
    if (!toolset) {
      toolset = toolSetForTool(registry, item);
    }
    if (!toolset || seen.has(toolset)) continue;
    const expanded = expandLegacyToolSetNames(registry, toolset);
    for (const name of expanded) {
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Expand ToolSet names to executable tool names */
export function toolNamesForToolSets(
  registry: ToolSetRegistry,
  toolsetNames: readonly string[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of toolsetNames) {
    const name = raw.trim();
    const set = registry.getToolSet(name);
    if (!set) continue;
    for (const def of set.tools) {
      if (seen.has(def.name)) continue;
      seen.add(def.name);
      out.push(def.name);
    }
  }
  return out;
}

/** Parse toolset_load call arguments */
export function parseToolSetsFromLoadArgs(args: unknown): string[] {
  if (!args || typeof args !== "object") return [];
  const record = args as Record<string, unknown>;
  const raw = record.toolsets ?? record.names;
  if (!Array.isArray(raw)) return [];
  return raw.map((n) => String(n ?? "").trim()).filter(Boolean);
}

/** Whether every ToolSet in a load call is already cached */
export function loadCallFullyCached(
  loadedToolsets: readonly string[],
  cachedToolsets: readonly string[],
): boolean {
  if (loadedToolsets.length === 0) return false;
  const cached = new Set(cachedToolsets);
  return loadedToolsets.every((n) => cached.has(n.trim()));
}
