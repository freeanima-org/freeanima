import type { PgRepositories, SessionStorePort } from "@freeanima/core/repos";
import { parseCompressionState, isCompressed } from "@freeanima/core/compress";
import type { SessionMessage, SessionMetaMessage } from "./message.ts";

function store(repos: PgRepositories): SessionStorePort {
  return repos.session;
}

export function postgresAvailable(repos: PgRepositories): boolean {
  return repos.pgAvailable;
}

export const usePostgresRead = postgresAvailable;

export async function pgWriteMeta(
  repos: PgRepositories,
  sessionId: string,
  meta: SessionMetaMessage,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).upsertSessionMeta(sessionId, meta);
}

export async function pgWritePatchMeta(
  repos: PgRepositories,
  sessionId: string,
  patch: Partial<SessionMetaMessage> & Record<string, unknown>,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).patchSessionMeta(sessionId, patch);
}

export async function pgWriteMessage(
  repos: PgRepositories,
  sessionId: string,
  msg: SessionMessage,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).appendMessage(sessionId, msg);
}

export async function pgWriteTruncate(
  repos: PgRepositories,
  sessionId: string,
  keepThroughPos: number,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).truncateMessagesAfter(sessionId, keepThroughPos);
}

export async function pgShiftMessagePositions(
  repos: PgRepositories,
  sessionId: string,
  afterPos: number,
  delta: number,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).shiftMessagePositions(sessionId, afterPos, delta);
}

export async function pgWriteDeleteSession(
  repos: PgRepositories,
  sessionId: string,
): Promise<void> {
  if (!postgresAvailable(repos)) return;
  await store(repos).deleteSession(sessionId);
}

export async function sessionExistsWithRouting(
  repos: PgRepositories,
  sessionId: string,
): Promise<boolean> {
  if (!postgresAvailable(repos)) return false;
  return store(repos).sessionExists(sessionId);
}

export async function loadMetaWithRouting(
  repos: PgRepositories,
  sessionId: string,
): Promise<SessionMetaMessage | Record<string, never>> {
  if (!postgresAvailable(repos)) {
    return {};
  }
  return (await store(repos).getSessionMetaLite(sessionId)) ?? {};
}

export async function loadMessagesWithRouting(
  repos: PgRepositories,
  sessionId: string,
): Promise<SessionMessage[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).listMessages(sessionId);
}

/** When compression boundary exists, runtime loads message window with pos > l2 only */
export async function loadMessagesForRuntimeWithRouting(
  repos: PgRepositories,
  sessionId: string,
  meta: SessionMetaMessage | Record<string, never>,
): Promise<SessionMessage[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  const compression = "compression" in meta ? meta.compression : undefined;
  const state = parseCompressionState(compression);
  if (state != null && isCompressed(state) && state.l2 > 0) {
    const fromPos = state.l2 + 1;
    return store(repos).listMessagesByPosRange(sessionId, fromPos);
  }
  return loadMessagesWithRouting(repos, sessionId);
}

export async function loadMessagesByPosRangeWithRouting(
  repos: PgRepositories,
  sessionId: string,
  fromPos: number,
  toPos?: number,
): Promise<SessionMessage[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).listMessagesByPosRange(sessionId, fromPos, toPos);
}

export async function loadMessagesPageWithRouting(
  repos: PgRepositories,
  sessionId: string,
  offset: number,
  limit: number,
): Promise<SessionMessage[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).listMessagesPage(sessionId, offset, limit);
}

export async function countMessagesWithRouting(
  repos: PgRepositories,
  sessionId: string,
): Promise<number> {
  if (!postgresAvailable(repos)) {
    return 0;
  }
  return store(repos).countMessages(sessionId);
}

export async function loadSessionToolsWithRouting(
  repos: PgRepositories,
  sessionId: string,
): Promise<SessionMetaMessage["cached_toolsets"]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).getSessionTools(sessionId);
}

export async function listSessionsWithRouting(
  repos: PgRepositories,
  platform?: string | null,
): Promise<string[]> {
  if (!postgresAvailable(repos)) {
    return [];
  }
  return store(repos).listSessionIds(platform);
}

export async function nextMessagePosWithRouting(
  repos: PgRepositories,
  sessionId: string,
): Promise<number> {
  if (!postgresAvailable(repos)) {
    throw new Error("database.url not configured");
  }
  return store(repos).nextMessagePos(sessionId);
}

export async function pgCountSessionsByPlatform(
  repos: PgRepositories,
): Promise<Record<string, number>> {
  return store(repos).countSessionsByPlatform();
}

export async function pgListSessionSummaries(
  repos: PgRepositories,
  platform?: string | null,
): Promise<Array<{ id: string; title: string; created: string; platform: string }>> {
  return store(repos).listSessionSummaries(platform);
}

export async function pgDeleteDebugSessions(repos: PgRepositories): Promise<number> {
  return store(repos).deleteDebugSessions();
}

export async function pgListDebugSessionIds(repos: PgRepositories): Promise<string[]> {
  return store(repos).listDebugSessionIds();
}

export async function pgLastMessageTimestamp(
  repos: PgRepositories,
  sessionId: string,
): Promise<string | null> {
  return store(repos).lastMessageTimestamp(sessionId);
}

export async function pgListSessionIdsMatchingPlatformProbe(
  repos: PgRepositories,
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string[]> {
  return store(repos).listSessionIdsMatchingPlatformProbe(platform, platformExtra);
}

export async function pgFindSessionIdByPlatformInfo(
  repos: PgRepositories,
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  return store(repos).findSessionIdByPlatformInfo(platform, platformExtra);
}

export async function pgGetSessionMeta(
  repos: PgRepositories,
  sessionId: string,
): Promise<SessionMetaMessage | null> {
  return store(repos).getSessionMeta(sessionId);
}

export async function pgGetSessionMetaLite(
  repos: PgRepositories,
  sessionId: string,
): Promise<SessionMetaMessage | null> {
  return store(repos).getSessionMetaLite(sessionId);
}

export async function pgListMessages(
  repos: PgRepositories,
  sessionId: string,
): Promise<SessionMessage[]> {
  return store(repos).listMessages(sessionId);
}
