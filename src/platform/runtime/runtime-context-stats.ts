import { SUMMARY_USER_PREFIX } from "@freeanima/core/compress";
import { isConversationMeta } from "@freeanima/core/db/domain";
import { decomposeSystemPromptParts } from "@freeanima/capabilities/memory/system-prompt";
import type { StoredMessage } from "@freeanima/core/db/domain";
import {
  estimateMessagesTokens,
  estimateTokens,
  estimateToolsTokens,
} from "@freeanima/core/compress";
import { PROFILE_CHAT } from "@freeanima/core/provider";
import { getProfileHopModel } from "@freeanima/platform/config";
import { loadSelfLayerPrompt } from "@freeanima/capabilities/identity";
import { renderToolsetsSection } from "@freeanima/capabilities/tools/toolset-prompt";
import type { RuntimeDeps } from "./runtime-deps.ts";

export type RuntimeContextBreakdown = {
  /** View sent to LLM (post-compression + summary injection), not full archive */
  system_self: number;
  system_agents: number;
  system_resident: number;
  system_toolsets: number;
  summary: number;
  messages: number;
  tools: number;
  total: number;
};

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
  const model = isConversationMeta(meta)
    ? meta.model
    : getProfileHopModel(deps.engine.config.data, PROFILE_CHAT);

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

/** Format as k tokens display (1 decimal; use tokens when <1000) */
export function formatTokenK(tokens: number): string {
  if (tokens <= 0) return "0";
  if (tokens < 1000) return `${tokens}`;
  const k = tokens / 1000;
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}
