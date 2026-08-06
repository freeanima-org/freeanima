import type { BeforeLlmCallContext } from "@freeanima/host/core/hooks/loop";
import { resolvePromptMode } from "@freeanima/host/core/hooks/prompt";
import { isConversationMeta } from "@freeanima/host/core/db/domain";
import { getConversationMeta } from "@freeanima/host/core/db/pg/conversation";

import { getNotificationPort } from "./port.ts";
import {
  manifestNotificationContext,
  NOTIFICATION_INJECT_LIMIT,
  stripNotificationContextFromMessages,
} from "./inject.ts";

export function createNotificationInjectHandler() {
  return async (ctx: BeforeLlmCallContext): Promise<void> => {
    stripNotificationContextFromMessages(ctx.messages);

    const lastMsg = ctx.messages.at(-1);
    if (!lastMsg || lastMsg.role !== "user") return;

    const conversationId = ctx.conversationId.trim();
    if (conversationId) {
      const meta = await getConversationMeta(conversationId);
      if (meta != null && isConversationMeta(meta) && resolvePromptMode(meta.module) === "work") {
        return;
      }
    }

    const port = getNotificationPort();
    if (!port) return;

    const agent = port.getAgentRecipient();
    const rows = await port.list({
      recipient_kind: agent.kind,
      recipient_id: agent.id,
      read_filter: "unread",
      limit: NOTIFICATION_INJECT_LIMIT,
    });
    if (rows.length === 0) return;

    manifestNotificationContext(ctx.messages, rows);
  };
}
