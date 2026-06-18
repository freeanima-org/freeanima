import type { PgRepositories } from "@freeanima/core/repos";
import type { SessionMetaMessage } from "@freeanima/core/db/domain";
import { applySessionToolMaskFilter } from "./mask-port.ts";
import { formatToolsForToolMessage } from "./catalog.ts";
import { resolveDefaultSessionToolSets } from "./default-session-toolsets.ts";
import { mergeToolSetNames, resolveToolSetNames, toolNamesForToolSets } from "./toolset-meta.ts";
import type { ToolCatalogMessageEntry } from "./catalog.ts";
import type { ToolSetRegistry } from "./toolset.ts";

export type LoadToolSetsIntoSessionResult = {
  loaded: string[];
  denied: string[];
  already_loaded: string[];
  unknown: string[];
  tools: ToolCatalogMessageEntry[];
};

export function resolveExecutableToolNames(
  meta: SessionMetaMessage,
  registry: ToolSetRegistry,
): string[] {
  const cached = resolveToolSetNames(registry, meta.cached_toolsets ?? []);
  const staged = resolveToolSetNames(registry, meta.staged_toolsets ?? []);
  return toolNamesForToolSets(registry, [...cached, ...staged]);
}

export async function loadToolSetsIntoSession(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  sessionId: string,
  toolsetNames: string[],
  meta: SessionMetaMessage,
): Promise<LoadToolSetsIntoSessionResult> {
  const unknown: string[] = [];
  const known: string[] = [];
  for (const name of toolsetNames.map((n) => n.trim()).filter(Boolean)) {
    if (registry.getToolSet(name)) {
      known.push(name);
    } else {
      unknown.push(name);
    }
  }

  const allowed = known.filter((name) => {
    if (registry.isToolSetPrivate(name)) {
      const toolNames = toolNamesForToolSets(registry, [name]);
      const filtered = applySessionToolMaskFilter(toolNames, meta);
      if (filtered.length === 0) return false;
      return true;
    }
    const toolNames = toolNamesForToolSets(registry, [name]);
    const filtered = applySessionToolMaskFilter(toolNames, meta);
    return filtered.length > 0;
  });
  const denied = known.filter((name) => !allowed.includes(name));

  const currentStaged = resolveToolSetNames(registry, meta.staged_toolsets ?? []);
  const already_loaded = allowed.filter((name) => currentStaged.includes(name));
  const toLoad = allowed.filter((name) => !currentStaged.includes(name));
  const nextStaged = mergeToolSetNames(currentStaged, toLoad);

  if (toLoad.length > 0 && repos.pgAvailable) {
    await repos.session.patchSessionMeta(sessionId, { staged_toolsets: nextStaged });
  }

  const expandedNames = toolNamesForToolSets(registry, [...toLoad, ...already_loaded]);
  return {
    loaded: toLoad,
    denied,
    already_loaded,
    unknown,
    tools: formatToolsForToolMessage(registry, expandedNames),
  };
}

export async function resetSessionToolSetsToDefault(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  sessionId: string,
): Promise<number> {
  const names = resolveDefaultSessionToolSets(registry);
  if (repos.pgAvailable) {
    await repos.session.patchSessionMeta(sessionId, {
      cached_toolsets: names,
      staged_toolsets: [],
    });
  }
  return names.length;
}
