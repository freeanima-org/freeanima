import { loadSessionMeta, updateSessionMetaField } from "@freeanima/legacy-engine";
import { isSessionMeta } from "@freeanima/legacy-kernel";



export type AcpSessionsMeta = Record<string, string>;

/** 从逸灵风 L1 session_meta 读取 acp_sessions */
export async function readAcpSessions(nestSessionId: string): Promise<AcpSessionsMeta> {
  const meta = await loadSessionMeta(nestSessionId);
  if (!isSessionMeta(meta)) return {};
  const raw = meta.acp_sessions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...raw };
}

export async function getBoundAcpSession(
  nestSessionId: string,
  agentName: string,
): Promise<string | undefined> {
  const sessions = await readAcpSessions(nestSessionId);
  return sessions[agentName];
}

export async function bindAcpSession(
  nestSessionId: string,
  agentName: string,
  acpSessionId: string,
): Promise<void> {
  const prev = await readAcpSessions(nestSessionId);
  await updateSessionMetaField(nestSessionId, {
    acp_sessions: { ...prev, [agentName]: acpSessionId },
  });
}

export async function unbindAcpSession(nestSessionId: string, agentName: string): Promise<void> {
  const prev = await readAcpSessions(nestSessionId);
  if (!(agentName in prev)) return;
  const next = { ...prev };
  delete next[agentName];
  await updateSessionMetaField(nestSessionId, { acp_sessions: next });
}
