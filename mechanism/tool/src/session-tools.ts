import type { PgRepositories } from "@freeanima/storage-repos";
import type { SessionMetaMessage } from "@freeanima/storage-db/domain";
import { applySessionToolMaskFilter } from "./mask-port.ts";
import { expandToolNames } from "./expand.ts";
import { formatToolsForToolMessage } from "./catalog.ts";
import { resolveDefaultSessionTools } from "./default-session-tools.ts";
import type { ToolCatalogMessageEntry } from "./catalog.ts";
import type { ToolSetRegistry } from "./toolset.ts";

export type LoadToolsIntoSessionResult = {
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
  const seen = new Set(current);
  const out = [...current];
  for (const name of toAdd) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function resolveExecutableToolNames(meta: SessionMetaMessage): string[] {
  const loaded = meta.loaded_tools ?? [];
  return [...new Set([...meta.tools, ...loaded])];
}

export async function loadToolsIntoSession(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  sessionId: string,
  names: string[],
  meta: SessionMetaMessage,
): Promise<LoadToolsIntoSessionResult> {
  const expanded = expandToolNames(registry, names);
  const unknown: string[] = [];
  const known: string[] = [];
  for (const name of expanded) {
    if (registry.getTool(name)) {
      known.push(name);
    } else {
      unknown.push(name);
    }
  }

  const allowed = applySessionToolMaskFilter(known, meta);
  const denied = known.filter((name) => !allowed.includes(name));

  const currentLoaded = meta.loaded_tools ?? [];
  const already_loaded = allowed.filter((name) => currentLoaded.includes(name));
  const toLoad = allowed.filter((name) => !currentLoaded.includes(name));
  const nextLoaded = mergeSessionToolNames(currentLoaded, toLoad);

  if (toLoad.length > 0 && repos.pgAvailable) {
    await repos.session.patchSessionMeta(sessionId, { loaded_tools: nextLoaded });
  }

  return {
    loaded: toLoad,
    denied,
    already_loaded,
    unknown,
    tools: formatToolsForToolMessage(registry, [...toLoad, ...already_loaded]),
  };
}

export async function resetSessionToolsToDefault(
  repos: PgRepositories,
  registry: ToolSetRegistry,
  sessionId: string,
): Promise<number> {
  const names = resolveDefaultSessionTools(registry);
  if (repos.pgAvailable) {
    await repos.session.patchSessionMeta(sessionId, {
      tools: names,
      loaded_tools: [],
    });
  }
  return names.length;
}
