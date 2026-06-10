import type { ConversationMessage } from "@freeanima/engine-repos";

export type RecallableMessage = {
  t: string;
  role: string;
  content: string;
};

/** Filter recallable user/assistant text from conversation messages (exclude tool and empty content) */
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
