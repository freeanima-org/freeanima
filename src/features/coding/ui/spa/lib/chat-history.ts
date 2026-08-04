import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import type { DisplayItem } from "@freeanima/shared/rpc-contract/frames/display.ts";

import { newMsgId, type CodingChatMessage } from "./chat-thread.ts";

/** Habitat display → Coding 轻量消息列表 */
export function displayItemsToChatMessages(display: readonly DisplayItem[]): CodingChatMessage[] {
  const out: CodingChatMessage[] = [];
  for (const item of display) {
    if (item.type === "message") {
      out.push({
        id: newMsgId(item.role),
        role: item.role,
        content: item.content,
      });
      continue;
    }
    for (const call of item.calls) {
      const preview = call.result?.trim();
      out.push({
        id: newMsgId("tool"),
        role: "tool",
        content: preview
          ? `✓ ${call.name}: ${preview.length > 240 ? `${preview.slice(0, 240)}…` : preview}`
          : `→ ${call.name}${call.argsPreview ? ` ${call.argsPreview}` : ""}`,
      });
    }
  }
  return out;
}

/** 拉取会话历史（尾页）；无 token / 失败时抛错由 UI 展示 */
export async function fetchCodingConversationHistory(
  conversationId: string,
  opts?: { limit?: number },
): Promise<CodingChatMessage[]> {
  const client = getTypedHabitatClient();
  const resp = await client.call("conversation.messages", {
    conversation_id: conversationId,
    limit: opts?.limit ?? 100,
  });
  const display = Array.isArray((resp as { display?: unknown }).display)
    ? (resp as { display: DisplayItem[] }).display
    : [];
  return displayItemsToChatMessages(display);
}
