import { SUMMARY_USER_PREFIX } from "@freeanima/engine-compress";
import { isSessionMeta } from "@freeanima/engine-db/domain";
import { decomposeSystemPromptParts } from "@freeanima/life-memory/system-prompt";
import type { SessionMessage } from "@freeanima/engine-db/domain";
import {
  estimateMessagesTokens,
  estimateTokens,
  estimateToolsTokens,
} from "@freeanima/engine-compress";
import { loadSelfLayerPrompt } from "@freeanima/life-self";
import { getServiceContext } from "../context.ts";

export type RuntimeContextBreakdown = {
  /** 发给 LLM 的视图（压缩后 + 摘要注入），非存档全量 */
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

/** 从运行时 message list 分项估算 token（与 compress 决策口径一致） */
export async function computeRuntimeContextBreakdown(
  session: string,
): Promise<RuntimeContextBreakdown> {
  const meta = await conv().loadSessionMeta(session);
  const [runtimeMsgs] = await conv().buildRuntimeMessages(session);
  const tools = isSessionMeta(meta) ? await conv().loadSessionTools(session, meta) : [];

  const selfContent = await loadSelfLayerPrompt();
  const cwd = isSessionMeta(meta) ? meta.cwd : undefined;
  const parts = await decomposeSystemPromptParts(selfContent, cwd);

  let summary = 0;
  const messageRows: SessionMessage[] = [];
  for (const m of runtimeMsgs) {
    if (m.role === "system") continue;
    if (m.role === "user") {
      const content = m.content;
      if (content.startsWith(SUMMARY_USER_PREFIX)) {
        summary += estimateTokens(content);
        continue;
      }
    }
    messageRows.push(m);
  }

  const system_self = estimateTokens(parts.self);
  const system_agents = estimateTokens(parts.agents);
  const system_resident = estimateTokens(parts.resident);
  const messages = estimateMessagesTokens(messageRows);
  const toolsTokens = estimateToolsTokens(tools);

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

/** 格式化为 k tokens 显示（保留 1 位小数，<1000 用 tokens） */
export function formatTokenK(tokens: number): string {
  if (tokens <= 0) return "0";
  if (tokens < 1000) return `${tokens}`;
  const k = tokens / 1000;
  return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
}
