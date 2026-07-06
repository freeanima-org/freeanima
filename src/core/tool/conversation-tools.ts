import type { ConversationMetaMessage } from "@freeanima/core/db/domain";
import { isPostgresPrimary } from "@freeanima/core/db/pg";
import { patchConversationMeta } from "@freeanima/core/db/pg/conversation";
import { applyConversationToolMaskFilter } from "./mask-port.ts";
import { formatToolsForToolMessage } from "./catalog.ts";
import { resolveDefaultConversationToolSets } from "./default-conversation-toolsets.ts";
import { mergeToolSetNames, resolveToolSetNames, toolNamesForToolSets } from "./toolset-meta.ts";
import type { ToolCatalogMessageEntry } from "./catalog.ts";
import type { ToolSetRegistry } from "./toolset.ts";

export type LoadToolSetsIntoConversationResult = {
  loaded: string[];
  denied: string[];
  already_loaded: string[];
  unknown: string[];
  tools: ToolCatalogMessageEntry[];
};

export function resolveExecutableToolNames(
  meta: ConversationMetaMessage,
  registry: ToolSetRegistry,
): string[] {
  const cached = resolveToolSetNames(registry, meta.cached_toolsets ?? []);
  const staged = resolveToolSetNames(registry, meta.staged_toolsets ?? []);
  return toolNamesForToolSets(registry, [...cached, ...staged]);
}

export async function loadToolSetsIntoConversation(
  registry: ToolSetRegistry,
  conversationId: string,
  toolsetNames: string[],
  meta: ConversationMetaMessage,
): Promise<LoadToolSetsIntoConversationResult> {
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
      const filtered = applyConversationToolMaskFilter(toolNames, meta);
      if (filtered.length === 0) return false;
      return true;
    }
    const toolNames = toolNamesForToolSets(registry, [name]);
    const filtered = applyConversationToolMaskFilter(toolNames, meta);
    return filtered.length > 0;
  });
  const denied = known.filter((name) => !allowed.includes(name));

  const currentStaged = resolveToolSetNames(registry, meta.staged_toolsets ?? []);
  const already_loaded = allowed.filter((name) => currentStaged.includes(name));
  const toLoad = allowed.filter((name) => !currentStaged.includes(name));
  const nextStaged = mergeToolSetNames(currentStaged, toLoad);

  if (toLoad.length > 0 && isPostgresPrimary()) {
    await patchConversationMeta(conversationId, { staged_toolsets: nextStaged });
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

export async function resetConversationToolsetsToDefault(
  registry: ToolSetRegistry,
  conversationId: string,
): Promise<number> {
  const names = resolveDefaultConversationToolSets(registry);
  if (isPostgresPrimary()) {
    await patchConversationMeta(conversationId, {
      cached_toolsets: names,
      staged_toolsets: [],
    });
  }
  return names.length;
}
