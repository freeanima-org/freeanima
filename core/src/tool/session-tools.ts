import type { PgRepositories } from "@freeanima/core/repos";
import type { SessionMetaMessage } from "@freeanima/core/db/domain";
import { applySessionToolMaskFilter } from "./mask-port.ts";
import { formatToolsForToolMessage } from "./catalog.ts";
import { resolveDefaultSessionToolsets } from "./default-session-toolsets.ts";
import { mergeToolsetNames, resolveToolsetNames, toolNamesForToolsets } from "./toolset-meta.ts";
import type { ToolCatalogMessageEntry } from "./catalog.ts";
import type { ToolSetRegistry } from "./toolset.ts";

export type LoadToolsetsIntoSessionResult = {
  loaded: string[];
  denied: string[];
  already_loaded: string[];
  unknown: string[];
  tools: ToolCatalogMessageEntry[];
};

export function mergeSessionToolNames(
  current: readonly string[],
  toAdd: readonly string[],
): string[] {
  return mergeToolsetNames(current, toAdd);
}

export function resolveExecutableToolNames(
  meta: SessionMetaMessage,
  registry: ToolSetRegistry,
): string[] {
  const cached = resolveToolsetNames(registry, meta.cached_toolsets ?? []);
  const staged = resolveToolsetNames(registry, meta.staged_toolsets ?? []);
  return toolNamesForToolsets(registry, [...cached, ...staged]);
}

export async function loadToolsetsIntoSession(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  sessionId: string,
  toolsetNames: string[],
  meta: SessionMetaMessage,
): Promise<LoadToolsetsIntoSessionResult> {
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
    const toolNames = toolNamesForToolsets(registry, [name]);
    const filtered = applySessionToolMaskFilter(toolNames, meta);
    return filtered.length > 0;
  });
  const denied = known.filter((name) => !allowed.includes(name));

  const currentStaged = resolveToolsetNames(registry, meta.staged_toolsets ?? []);
  const already_loaded = allowed.filter((name) => currentStaged.includes(name));
  const toLoad = allowed.filter((name) => !currentStaged.includes(name));
  const nextStaged = mergeToolsetNames(currentStaged, toLoad);

  if (toLoad.length > 0 && repos.pgAvailable) {
    await repos.session.patchSessionMeta(sessionId, { staged_toolsets: nextStaged });
  }

  const expandedNames = toolNamesForToolsets(registry, [...toLoad, ...already_loaded]);
  return {
    loaded: toLoad,
    denied,
    already_loaded,
    unknown,
    tools: formatToolsForToolMessage(registry, expandedNames),
  };
}

/** @deprecated use loadToolsetsIntoSession */
export async function loadToolsIntoSession(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  sessionId: string,
  names: string[],
  meta: SessionMetaMessage,
): Promise<LoadToolsetsIntoSessionResult> {
  return loadToolsetsIntoSession(repos, registry, sessionId, names, meta);
}

export async function resetSessionToolsetsToDefault(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  sessionId: string,
): Promise<number> {
  const names = resolveDefaultSessionToolsets(registry);
  if (repos.pgAvailable) {
    await repos.session.patchSessionMeta(sessionId, {
      cached_toolsets: names,
      staged_toolsets: [],
    });
  }
  return names.length;
}

/** @deprecated use resetSessionToolsetsToDefault */
export async function resetSessionToolsToDefault(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  sessionId: string,
): Promise<number> {
  return resetSessionToolsetsToDefault(repos, registry, sessionId);
}
