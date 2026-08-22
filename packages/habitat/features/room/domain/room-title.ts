import { sanitizeConversationTitle } from "@freeanima/habitat/core/llm";

/** 创建时占位标题：首条公开消息后可走 LLM 改写。 */
export function isRoomTitlePendingLlm(title: string): boolean {
  const t = title.trim();
  return !t || t === "新群聊" || t === "群聊";
}

/**
 * 群聊内心席侧栏标题：群聊·{房名}·{Anima}
 * 便于在私聊列表中辨认，且与 Room 标题同步。
 */
export function formatRoomInnerConversationTitle(roomTitle: string, agentLabel: string): string {
  const room = roomTitle.trim() || "群聊";
  const agent = agentLabel.trim() || "Anima";
  return sanitizeConversationTitle(`群聊·${room}·${agent}`);
}
