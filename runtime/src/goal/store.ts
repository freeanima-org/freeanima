import { isConversationMeta } from "@freeanima/core/db/domain";
import { parseConversationGoal, type ConversationGoal } from "@freeanima/core/db/domain";
import type { ConversationPort } from "@freeanima/core/tool/conversation-port";

export async function readConversationGoal(
  conversation: ConversationPort,
  conversationId: string,
): Promise<ConversationGoal | null> {
  const meta = await conversation.loadConversationMeta(conversationId);
  if (!isConversationMeta(meta)) return null;
  return parseConversationGoal(meta.goal);
}

export async function patchConversationGoal(
  conversation: ConversationPort,
  conversationId: string,
  goal: ConversationGoal | null,
): Promise<void> {
  await conversation.updateConversationMetaField(conversationId, { goal });
}

export async function clearConversationGoal(
  conversation: ConversationPort,
  conversationId: string,
): Promise<void> {
  await patchConversationGoal(conversation, conversationId, null);
}
