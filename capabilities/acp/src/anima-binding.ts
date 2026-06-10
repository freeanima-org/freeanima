import type { ConversationService } from "@freeanima/engine-conversation";
import { isSessionMeta } from "@freeanima/engine-db/domain";

export type AcpSessionsMeta = Record<string, string>;

/** Read acp_sessions from Free Anima session_meta */
export async function readAcpSessions(
  conversation: ConversationService,
  animaSessionId: string,
): Promise<AcpSessionsMeta> {
  const meta = await conversation.loadSessionMeta(animaSessionId);
  if (!isSessionMeta(meta)) return {};
  const raw = meta.acp_sessions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...raw };
}

export async function getBoundAcpSession(
  conversation: ConversationService,
  animaSessionId: string,
  agentName: string,
): Promise<string | undefined> {
  const sessions = await readAcpSessions(conversation, animaSessionId);
  return sessions[agentName];
}

export async function bindAcpSession(
  conversation: ConversationService,
  animaSessionId: string,
  agentName: string,
  acpSessionId: string,
): Promise<void> {
  const prev = await readAcpSessions(conversation, animaSessionId);
  await conversation.updateSessionMetaField(animaSessionId, {
    acp_sessions: { ...prev, [agentName]: acpSessionId },
  });
}

export async function unbindAcpSession(
  conversation: ConversationService,
  animaSessionId: string,
  agentName: string,
): Promise<void> {
  const prev = await readAcpSessions(conversation, animaSessionId);
  if (!(agentName in prev)) return;
  const next = { ...prev };
  delete next[agentName];
  await conversation.updateSessionMetaField(animaSessionId, { acp_sessions: next });
}
