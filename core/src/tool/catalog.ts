import type { JsonSchemaObject } from "./registry.ts";
import { tokenizeFtsQuery } from "@freeanima/core/util";
import type { ToolSetRegistry } from "./toolset.ts";

export type ToolCatalogEntry = {
  name: string;
  description: string;
  toolset: string;
};

export type ToolCatalogMessageEntry = ToolCatalogEntry & {
  parameters: JsonSchemaObject;
};

export type SearchToolsetsCatalogHit = {
  toolset: string;
  description: string;
  tools: ToolCatalogEntry[];
  allowed: boolean;
};

export type SearchToolsetsCatalogOptions = {
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

function toolsetEntries(registry: ToolSetRegistry): Array<{
  name: string;
  description: string;
  tools: ToolCatalogEntry[];
}> {
  return registry.listToolSets().map((view) => {
    const ts = registry.getToolSet(view.name)!;
    return {
      name: ts.name,
      description: ts.description,
      tools: ts.tools.map((def) => ({
        name: def.name,
        description: def.description,
        toolset: ts.name,
      })),
    };
  });
}

function matchesAllTokens(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase();
  return tokens.every((token) => {
    const t = token.replace(/^"|"$/g, "").trim().toLowerCase();
    if (!t) return true;
    return lower.includes(t);
  });
}

function isDynamicToolset(name: string): boolean {
  return name.startsWith("mcp_") || name.startsWith("acp_") || name.startsWith("sap_");
}

/** Memory FTS search grouped by ToolSet; AND token match on name/description */
export function searchToolsetsCatalog(
  registry: ToolSetRegistry,
  query: string,
  opts?: SearchToolsetsCatalogOptions,
): { query: string; hits: SearchToolsetsCatalogHit[]; total: number } {
  const trimmed = query.trim();
  const tokens = tokenizeFtsQuery(trimmed).filter((t) => t.length > 0);
  if (!tokens.length) {
    return { query: trimmed, hits: [], total: 0 };
  }

  let hits = toolsetEntries(registry)
    .map((ts) => {
      const toolText = ts.tools.map((t) => `${t.name} ${t.description}`).join(" ");
      const haystack = `${ts.name} ${ts.description} ${toolText}`;
      if (!matchesAllTokens(haystack, tokens)) return null;
      return {
        toolset: ts.name,
        description: ts.description,
        tools: ts.tools,
        allowed: true,
      };
    })
    .filter((h): h is SearchToolsetsCatalogHit => h != null);

  hits = hits.toSorted((a, b) => {
    const da = isDynamicToolset(a.toolset) ? 0 : 1;
    const db = isDynamicToolset(b.toolset) ? 0 : 1;
    if (da !== db) return da - db;
    return a.toolset.localeCompare(b.toolset);
  });

  const total = hits.length;
  const limit = opts?.limit;
  if (limit != null && limit >= 0) {
    hits = hits.slice(0, limit);
  }
  return { query: trimmed, hits, total };
}

/** @deprecated use searchToolsetsCatalog */
export function searchToolsCatalog(
  registry: ToolSetRegistry,
  query: string,
  opts?: { toolset?: string; limit?: number },
): { query: string; tools: ToolCatalogEntry[]; total: number } {
  const result = searchToolsetsCatalog(registry, query, { limit: opts?.limit });
  let tools = result.hits.flatMap((h) => h.tools);
  const toolset = opts?.toolset?.trim();
  if (toolset) {
    tools = tools.filter((t) => t.toolset === toolset);
  }
  return { query: result.query, tools, total: tools.length };
}

/** @deprecated */
export function listToolsCatalog(
  registry: ToolSetRegistry,
  opts?: { offset?: number; limit?: number; toolset?: string },
): { tools: ToolCatalogEntry[]; total: number } {
  let entries = allCatalogEntries(registry);
  const toolset = opts?.toolset?.trim();
  if (toolset) entries = entries.filter((e) => e.toolset === toolset);
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

export { expandToolNames } from "./expand.ts";
