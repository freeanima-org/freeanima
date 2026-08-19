import { SUMMARY_USER_PREFIX } from "@freeanima/habitat/core/compress";
import { isConversationMeta } from "@freeanima/habitat/core/db/domain";
import { decomposeSystemPromptParts } from "@freeanima/habitat/capabilities/memory/system-prompt";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import {
  estimateMessagesTokens,
  estimateTokens,
  estimateToolsTokens,
} from "@freeanima/habitat/core/compress";
import { PROFILE_CHAT } from "@freeanima/habitat/core/provider";
import { getProfileHopModel } from "@freeanima/habitat/platform/config";
import { lookupCatalogContextWindow } from "@freeanima/habitat/core/config";
import { loadSelfLayerPrompt } from "@freeanima/habitat/capabilities/self";
import { renderToolsetsSection } from "@freeanima/habitat/capabilities/tools/toolset-prompt";
import {
  type ConversationContextUsage,
  type RuntimeContextBreakdown,
} from "@freeanima/shared/llm-usage";
import type { RuntimeDeps } from "./runtime-deps.ts";

export type { ConversationContextUsage, RuntimeContextBreakdown };
export { formatTokenK } from "@freeanima/shared/llm-usage";

/** Estimate tokens by breakdown from runtime message list (same basis as compress decisions) */
export async function computeRuntimeContextBreakdown(
  deps: RuntimeDeps,
  conversationId: string,
): Promise<RuntimeContextBreakdown> {
  const meta = await deps.conversation.loadConversationMeta(conversationId);
  const [runtimeMsgs] = await deps.conversation.buildRuntimeMessages(conversationId);
  const tools = isConversationMeta(meta)
    ? await deps.conversation.loadConversationTools(conversationId, meta)
    : [];

  const selfContent = await loadSelfLayerPrompt();
  const cwd = isConversationMeta(meta) ? meta.cwd : undefined;
  const parts = await decomposeSystemPromptParts(selfContent, cwd);
  const toolsets = renderToolsetsSection(deps.engine.catalog.toolSets);
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);

  let summary = 0;
  const messageRows: StoredMessage[] = [];
  for (const m of runtimeMsgs) {
    if (m.role === "system") continue;
    if (m.role === "user") {
      const content = m.content;
      if (content.startsWith(SUMMARY_USER_PREFIX)) {
        summary += estimateTokens(content, model);
        continue;
      }
    }
    messageRows.push(m);
  }

  const system_self = estimateTokens(parts.self, model);
  const system_agents = estimateTokens(parts.agents, model);
  const system_resident = estimateTokens(parts.resident, model);
  const system_toolsets = estimateTokens(toolsets, model);
  const messages = estimateMessagesTokens(messageRows, model);
  const toolsTokens = estimateToolsTokens(tools, model);

  const total =
    system_self +
    system_agents +
    system_resident +
    system_toolsets +
    summary +
    messages +
    toolsTokens;

  return {
    system_self,
    system_agents,
    system_resident,
    system_toolsets,
    summary,
    messages,
    tools: toolsTokens,
    total,
  };
}

export async function computeConversationContextUsage(
  deps: RuntimeDeps,
  conversationId: string,
): Promise<ConversationContextUsage> {
  const breakdown = await computeRuntimeContextBreakdown(deps, conversationId);
  const model = getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);
  const window = model ? ((await lookupCatalogContextWindow(model)) ?? null) : null;
  return { used: breakdown.total, window, breakdown };
}
