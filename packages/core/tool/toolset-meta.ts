import { isRecord } from "@freeanima/shared/util";
import type { ToolSetRegistry } from "./toolset.ts";

export const TOOL_SET_LOAD_TOOL_NAME = "toolset_load";
export const TOOL_SET_UNLOAD_TOOL_NAME = "toolset_unload";
export const TOOL_SET_SEARCH_TOOL_NAME = "toolset_search";

/** Legacy ToolSet names → canonical set after consolidation */
const LEGACY_TOOLSET_ALIASES: Record<string, string> = {
  task: "agenda",
  tasklist: "agenda",
  project: "agenda",
  calendar: "agenda",
  "email-account": "email",
  note: "content",
  diary: "content",
  "content-block": "content",
  memory_semantic: "memory",
  code: "shell",
  terminal: "shell",
  tag: "entity",
};

function canonicalizeToolSetName(registry: ToolSetRegistry, toolset: string): string {
  const aliased = LEGACY_TOOLSET_ALIASES[toolset] ?? toolset;
  if (registry.getToolSet(aliased) != null) return aliased;
  if (registry.getToolSet(toolset) != null) return toolset;
  return aliased;
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

/** Remove ToolSet names while preserving order of the remainder */
export function removeToolSetNames(
  current: readonly string[],
  toRemove: readonly string[],
): string[] {
  const drop = new Set(toRemove.map((n) => n.trim()).filter(Boolean));
  return current.map((n) => n.trim()).filter((name) => name.length > 0 && !drop.has(name));
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
      const aliased = canonicalizeToolSetName(registry, item);
      toolset = registry.getToolSet(aliased)?.name ?? null;
    }
    if (!toolset) {
      toolset = toolSetForTool(registry, item);
    }
    if (!toolset) continue;
    toolset = canonicalizeToolSetName(registry, toolset);
    if (seen.has(toolset)) continue;
    if (registry.getToolSet(toolset) == null) continue;
    seen.add(toolset);
    out.push(toolset);
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
    const name = canonicalizeToolSetName(registry, raw.trim());
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
  if (!isRecord(args)) return [];
  const record = args;
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
