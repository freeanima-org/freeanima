import { getKernel } from "@freeanima/kernel";
import type { SessionStorePort } from "@freeanima/kernel";
import { parseCompressionState, isCompressed } from "@freeanima/engine-compress";
import type { SessionMessage, SessionMetaMessage } from "@freeanima/kernel-schemas";

function store(): SessionStorePort {
  return getKernel().repos.session;
}

export function postgresAvailable(): boolean {
  return getKernel().repos.pgAvailable;
}

export const usePostgresRead = postgresAvailable;

export async function pgWriteMeta(sessionId: string, meta: SessionMetaMessage): Promise<void> {
  if (!postgresAvailable()) return;
  await store().upsertSessionMeta(sessionId, meta);
}

export async function pgWritePatchMeta(
  sessionId: string,
  patch: Partial<SessionMetaMessage> & Record<string, unknown>,
): Promise<void> {
  if (!postgresAvailable()) return;
  await store().patchSessionMeta(sessionId, patch);
}

export async function pgWriteMessage(sessionId: string, msg: SessionMessage): Promise<void> {
  if (!postgresAvailable()) return;
  await store().appendMessage(sessionId, msg);
}

export async function pgWriteTruncate(sessionId: string, keepThroughPos: number): Promise<void> {
  if (!postgresAvailable()) return;
  await store().truncateMessagesAfter(sessionId, keepThroughPos);
}

export async function pgShiftMessagePositions(
  sessionId: string,
  afterPos: number,
  delta: number,
): Promise<void> {
  if (!postgresAvailable()) return;
  await store().shiftMessagePositions(sessionId, afterPos, delta);
}

export async function pgWriteDeleteSession(sessionId: string): Promise<void> {
  if (!postgresAvailable()) return;
  await store().deleteSession(sessionId);
}

export async function sessionExistsWithRouting(sessionId: string): Promise<boolean> {
  if (!postgresAvailable()) return false;
  return store().sessionExists(sessionId);
}

export async function loadMetaWithRouting(
  sessionId: string,
): Promise<SessionMetaMessage | Record<string, never>> {
  if (!postgresAvailable()) {
    return {};
  }
  return (await store().getSessionMetaLite(sessionId)) ?? {};
}

export async function loadMessagesWithRouting(sessionId: string): Promise<SessionMessage[]> {
  if (!postgresAvailable()) {
    return [];
  }
  return store().listMessages(sessionId);
}

/** 已有压缩边界时，运行时只拉 pos > l2 的消息窗口 */
export async function loadMessagesForRuntimeWithRouting(
  sessionId: string,
  meta: SessionMetaMessage | Record<string, never>,
): Promise<SessionMessage[]> {
  if (!postgresAvailable()) {
    return [];
  }
  const compression = "compression" in meta ? meta.compression : undefined;
  const state = parseCompressionState(compression);
  if (state != null && isCompressed(state) && state.l2 > 0) {
    const fromPos = state.l2 + 1;
    return store().listMessagesByPosRange(sessionId, fromPos);
  }
  return loadMessagesWithRouting(sessionId);
}

export async function loadMessagesPageWithRouting(
  sessionId: string,
  offset: number,
  limit: number,
): Promise<SessionMessage[]> {
  if (!postgresAvailable()) {
    return [];
  }
  return store().listMessagesPage(sessionId, offset, limit);
}

export async function countMessagesWithRouting(sessionId: string): Promise<number> {
  if (!postgresAvailable()) {
    return 0;
  }
  return store().countMessages(sessionId);
}

export async function loadSessionToolsWithRouting(
  sessionId: string,
): Promise<SessionMetaMessage["tools"]> {
  if (!postgresAvailable()) {
    return [];
  }
  return store().getSessionTools(sessionId);
}

export async function listSessionsWithRouting(platform?: string | null): Promise<string[]> {
  if (!postgresAvailable()) {
    return [];
  }
  return store().listSessionIds(platform);
}

export async function nextMessagePosWithRouting(sessionId: string): Promise<number> {
  if (!postgresAvailable()) {
    throw new Error("database.url 未配置");
  }
  return store().nextMessagePos(sessionId);
}

export async function pgCountSessionsByPlatform(): Promise<Record<string, number>> {
  return store().countSessionsByPlatform();
}

export async function pgListSessionSummaries(
  platform?: string | null,
): Promise<Array<{ id: string; title: string; created: string; platform: string }>> {
  return store().listSessionSummaries(platform);
}

export async function pgDeleteDebugSessions(): Promise<number> {
  return store().deleteDebugSessions();
}

export async function pgListDebugSessionIds(): Promise<string[]> {
  return store().listDebugSessionIds();
}

export async function pgLastMessageTimestamp(sessionId: string): Promise<string | null> {
  return store().lastMessageTimestamp(sessionId);
}

export async function pgFindSessionIdByPlatformInfo(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  return store().findSessionIdByPlatformInfo(platform, platformExtra);
}

export async function pgGetSessionMeta(sessionId: string): Promise<SessionMetaMessage | null> {
  return store().getSessionMeta(sessionId);
}

export async function pgGetSessionMetaLite(sessionId: string): Promise<SessionMetaMessage | null> {
  return store().getSessionMetaLite(sessionId);
}

export async function pgListMessages(sessionId: string): Promise<SessionMessage[]> {
  return store().listMessages(sessionId);
}

/** @deprecated 使用 pgWriteMeta */
export const maybeDualWriteMeta = pgWriteMeta;
/** @deprecated 使用 pgWritePatchMeta */
export const maybeDualWritePatchMeta = pgWritePatchMeta;
/** @deprecated 使用 pgWriteMessage */
export const maybeDualWriteMessage = pgWriteMessage;
/** @deprecated 使用 pgWriteTruncate */
export const maybeDualWriteTruncate = pgWriteTruncate;
/** @deprecated 使用 pgWriteDeleteSession */
export const maybeDualWriteDeleteSession = pgWriteDeleteSession;
