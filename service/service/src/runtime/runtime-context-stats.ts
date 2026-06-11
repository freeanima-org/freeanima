import { SUMMARY_USER_PREFIX } from "@freeanima/engine-compress";
import { isSessionMeta } from "@freeanima/engine-db/domain";
import { decomposeSystemPromptParts } from "@freeanima/life-memory/system-prompt";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import {
  estimateMessagesTokens,
  estimateTokens,
  estimateToolsTokens,
} from "@freeanima/engine-compress";
import { PROFILE_CHAT } from "@freeanima/engine-provider-llm";
import { getProfileHopModel } from "@freeanima/service-config";
import { loadSelfLayerPrompt } from "@freeanima/life-self";
import { getServiceContext } from "../context.ts";

export type RuntimeContextBreakdown = {
  /** View sent to LLM (post-compression + summary injection), not full archive */
  system_self: number;
  system_agents: number;
  system_resident: number;
  summary: number;
  messages: number;
  tools: number;
  total: number;
};

function conv() {
  return getServiceContext().conversation;
}

/** Estimate tokens by breakdown from runtime message list (same basis as compress decisions) */
export async function computeRuntimeContextBreakdown(
  session: string,
): Promise<RuntimeContextBreakdown> {
  const meta = await conv().loadSessionMeta(session);
  const [runtimeMsgs] = await conv().buildRuntimeMessages(session);
  const tools = isSessionMeta(meta) ? await conv().loadSessionTools(session, meta) : [];

  const selfContent = await loadSelfLayerPrompt();
  const cwd = isSessionMeta(meta) ? meta.cwd : undefined;
  const parts = await decomposeSystemPromptParts(selfContent, cwd);
  const model = isSessionMeta(meta)
    ? meta.model
    : getProfileHopModel(getServiceContext().engine.config.data, PROFILE_CHAT);

  let summary = 0;
  const messageRows: SessionMessage[] = [];
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
  const messages = estimateMessagesTokens(messageRows, model);
  const toolsTokens = estimateToolsTokens(tools, model);

  const total = system_self + system_agents + system_resident + summary + messages + toolsTokens;

  return {
    system_self,
    system_agents,
    system_resident,
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
