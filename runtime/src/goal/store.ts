import { isSessionMeta } from "@freeanima/core/db/domain";
import { parseSessionGoal, type SessionGoal } from "@freeanima/core/db/domain";
import type { SessionConversationPort } from "@freeanima/core/tool/session-conversation-port";

export async function readSessionGoal(
  conversation: SessionConversationPort,
  sessionId: string,
): Promise<SessionGoal | null> {
  const meta = await conversation.loadSessionMeta(sessionId);
  if (!isSessionMeta(meta)) return null;
  return parseSessionGoal(meta.goal);
}

export async function patchSessionGoal(
  conversation: SessionConversationPort,
  sessionId: string,
  goal: SessionGoal | null,
): Promise<void> {
  await conversation.updateSessionMetaField(sessionId, { goal });
}

export async function clearSessionGoal(
  conversation: SessionConversationPort,
  sessionId: string,
): Promise<void> {
  await patchSessionGoal(conversation, sessionId, null);
}
