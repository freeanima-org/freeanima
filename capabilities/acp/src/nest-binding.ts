import type { ConversationService } from "@freeanima/engine-conversation";
import { isSessionMeta } from "@freeanima/engine-conversation";

export type AcpSessionsMeta = Record<string, string>;

/** 从逸灵风 L1 session_meta 读取 acp_sessions */
export async function readAcpSessions(
  conversation: ConversationService,
  nestSessionId: string,
): Promise<AcpSessionsMeta> {
  const meta = await conversation.loadSessionMeta(nestSessionId);
  if (!isSessionMeta(meta)) return {};
  const raw = meta.acp_sessions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...raw };
}

export async function getBoundAcpSession(
  conversation: ConversationService,
  nestSessionId: string,
  agentName: string,
): Promise<string | undefined> {
  const sessions = await readAcpSessions(conversation, nestSessionId);
  return sessions[agentName];
}

export async function bindAcpSession(
  conversation: ConversationService,
  nestSessionId: string,
  agentName: string,
  acpSessionId: string,
): Promise<void> {
  const prev = await readAcpSessions(conversation, nestSessionId);
  await conversation.updateSessionMetaField(nestSessionId, {
    acp_sessions: { ...prev, [agentName]: acpSessionId },
  });
}

export async function unbindAcpSession(
  conversation: ConversationService,
  nestSessionId: string,
  agentName: string,
): Promise<void> {
  const prev = await readAcpSessions(conversation, nestSessionId);
  if (!(agentName in prev)) return;
  const next = { ...prev };
  delete next[agentName];
  await conversation.updateSessionMetaField(nestSessionId, { acp_sessions: next });
}
