import type { ConversationMessage } from "@freeanima/engine-repos";

export type RecallableMessage = {
  t: string;
  role: string;
  content: string;
};

/** 从 L1 消息中筛出可召回/可 reflect 的 user/assistant 文本（对齐原 L2 蒸馏规则） */
export function filterRecallableMessages(msgs: ConversationMessage[]): RecallableMessage[] {
  const out: RecallableMessage[] = [];
  for (const rec of msgs) {
    const role = rec.role;
    if (role !== "user" && role !== "assistant") continue;
    const content = rec.content;
    if (!content || !String(content).trim()) {
      if (role === "assistant" && "tool_calls" in rec && rec.tool_calls) continue;
      continue;
    }
    out.push({
      t: rec.timestamp ?? "",
      role,
      content: String(content).trim(),
    });
  }
  return out;
}
