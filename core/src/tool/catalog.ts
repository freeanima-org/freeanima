import type { JsonSchemaObject } from "./registry.ts";
import { expandToolNames } from "./expand.ts";
import type { ToolSetRegistry } from "./toolset.ts";

export type ToolCatalogEntry = {
  name: string;
  description: string;
  toolset: string;
};

export type ToolCatalogMessageEntry = ToolCatalogEntry & {
  parameters: JsonSchemaObject;
};

export type ListToolsCatalogOptions = {
  offset?: number;
  limit?: number;
  toolset?: string;
};

export type SearchToolsCatalogOptions = {
  toolset?: string;
  limit?: number;
};

function toolsetForName(registry: ToolSetRegistry, toolName: string): string {
  for (const ts of registry.listToolSets()) {
    if (ts.tools.includes(toolName)) return ts.name;
  }
  return "";
}

function allCatalogEntries(registry: ToolSetRegistry): ToolCatalogEntry[] {
  return registry.listTools().map((def) => ({
    name: def.name,
    description: def.description,
    toolset: toolsetForName(registry, def.name),
  }));
}

function matchesQuery(entry: ToolCatalogEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    entry.name.toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q) ||
    entry.toolset.toLowerCase().includes(q)
  );
}

export function listToolsCatalog(
  registry: ToolSetRegistry,
  opts?: ListToolsCatalogOptions,
): { tools: ToolCatalogEntry[]; total: number } {
  const toolset = opts?.toolset?.trim();
  let entries = allCatalogEntries(registry);
  if (toolset) {
    entries = entries.filter((e) => e.toolset === toolset);
  }
  const total = entries.length;
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = opts?.limit;
  if (limit != null && limit >= 0) {
    entries = entries.slice(offset, offset + limit);
  } else if (offset > 0) {
    entries = entries.slice(offset);
  }
  return { tools: entries, total };
}

export function searchToolsCatalog(
  registry: ToolSetRegistry,
  query: string,
  opts?: SearchToolsCatalogOptions,
): { query: string; tools: ToolCatalogEntry[]; total: number } {
  const toolset = opts?.toolset?.trim();
  let entries = allCatalogEntries(registry).filter((e) => matchesQuery(e, query));
  if (toolset) {
    entries = entries.filter((e) => e.toolset === toolset);
  }
  const total = entries.length;
  const limit = opts?.limit;
  if (limit != null && limit >= 0) {
    entries = entries.slice(0, limit);
  }
  return { query: query.trim(), tools: entries, total };
}

export { expandToolNames };

export function formatToolsForToolMessage(
  registry: ToolSetRegistry,
  names: readonly string[],
): ToolCatalogMessageEntry[] {
  const out: ToolCatalogMessageEntry[] = [];
  for (const name of names) {
    const def = registry.getTool(name);
    if (!def) continue;
    out.push({
      name: def.name,
      description: def.description,
      toolset: toolsetForName(registry, def.name),
      parameters: def.parameters,
    });
  }
  return out;
}
