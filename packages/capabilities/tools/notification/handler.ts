import type { BeforeLlmCallContext } from "@freeanima/core/hooks/loop";
import { resolveScenarioProfile } from "@freeanima/core/hooks/prompt";
import { isConversationMeta } from "@freeanima/core/db/domain";
import { getConversationMeta } from "@freeanima/core/db/pg/conversation";

import type { NotificationPort } from "./port.ts";
import {
  manifestNotificationContext,
  NOTIFICATION_INJECT_LIMIT,
  stripNotificationContextFromMessages,
} from "./inject.ts";

export function createNotificationInjectHandler(port: NotificationPort | null) {
  return async (ctx: BeforeLlmCallContext): Promise<void> => {
    stripNotificationContextFromMessages(ctx.messages);

    const lastMsg = ctx.messages.at(-1);
    if (!lastMsg || lastMsg.role !== "user") return;

    const conversationId = ctx.conversationId.trim();
    if (!conversationId) return;

    const meta = await getConversationMeta(conversationId);
    if (
      meta != null &&
      isConversationMeta(meta) &&
      resolveScenarioProfile(meta.scenario).prompt === "work"
    ) {
      return;
    }

    const agentSubjectId =
      meta != null && isConversationMeta(meta) ? meta.agent_subject_id : undefined;
    if (agentSubjectId == null || agentSubjectId <= 0) return;

    if (!port) return;

    const rows = await port.list({
      recipient_kind: "agent",
      recipient_id: agentSubjectId,
      read_filter: "unread",
      limit: NOTIFICATION_INJECT_LIMIT,
    });
    if (rows.length === 0) return;

    manifestNotificationContext(ctx.messages, rows);
  };
}
