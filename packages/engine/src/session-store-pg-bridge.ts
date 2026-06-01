import {
  isPostgresPrimary,
  appendMessage as dbAppendMessage,
  countMessages as dbCountMessages,
  countSessionsByPlatform as dbCountSessionsByPlatform,
  deleteDebugSessions as dbDeleteDebugSessions,
  deleteSession as dbDeleteSession,
  findSessionIdByPlatformInfo as dbFindSessionIdByPlatformInfo,
  getSessionMeta as dbGetSessionMeta,
  getSessionMetaLite as dbGetSessionMetaLite,
  getSessionTools as dbGetSessionTools,
  lastMessageTimestamp as dbLastMessageTimestamp,
  listDebugSessionIds as dbListDebugSessionIds,
  listMessages as dbListMessages,
  listMessagesByPosRange as dbListMessagesByPosRange,
  listMessagesPage as dbListMessagesPage,
  listSessionIds as dbListSessionIds,
  listSessionSummaries as dbListSessionSummaries,
  nextMessagePos as dbNextMessagePos,
  patchSessionMeta as dbPatchSessionMeta,
  pgProfileWrap,
  sessionExists as dbSessionExists,
  truncateMessagesAfter as dbTruncateMessagesAfter,
  shiftMessagePositions as dbShiftMessagePositions,
  upsertSessionMeta as dbUpsertSessionMeta,
} from "@freeanima/db";
import { parseCompressionState, isCompressed } from "./compressor.js";
import type { SessionMessage, SessionMetaMessage } from "@freeanima/kernel";

export function postgresAvailable(): boolean {
  return isPostgresPrimary();
}

export const usePostgresRead = postgresAvailable;

export async function pgWriteMeta(sessionId: string, meta: SessionMetaMessage): Promise<void> {
  if (!postgresAvailable()) return;
  await dbUpsertSessionMeta(sessionId, meta);
}

export async function pgWritePatchMeta(
  sessionId: string,
  patch: Partial<SessionMetaMessage> & Record<string, unknown>,
): Promise<void> {
  if (!postgresAvailable()) return;
  await dbPatchSessionMeta(sessionId, patch);
}

export async function pgWriteMessage(sessionId: string, msg: SessionMessage): Promise<void> {
  if (!postgresAvailable()) return;
  await dbAppendMessage(sessionId, msg);
}

export async function pgWriteTruncate(sessionId: string, keepThroughPos: number): Promise<void> {
  if (!postgresAvailable()) return;
  await dbTruncateMessagesAfter(sessionId, keepThroughPos);
}

export async function pgShiftMessagePositions(
  sessionId: string,
  afterPos: number,
  delta: number,
): Promise<void> {
  if (!postgresAvailable()) return;
  await dbShiftMessagePositions(sessionId, afterPos, delta);
}

export async function pgWriteDeleteSession(sessionId: string): Promise<void> {
  if (!postgresAvailable()) return;
  await dbDeleteSession(sessionId);
}

export async function sessionExistsWithRouting(sessionId: string): Promise<boolean> {
  if (!postgresAvailable()) return false;
  return dbSessionExists(sessionId);
}

export async function loadMetaWithRouting(
  sessionId: string,
): Promise<SessionMetaMessage | Record<string, never>> {
  if (!postgresAvailable()) {
    return {};
  }
  return (
    (await pgProfileWrap("getSessionMetaLite", () => dbGetSessionMetaLite(sessionId), {
      sessionId,
    })) ?? {}
  );
}

export async function loadMessagesWithRouting(sessionId: string): Promise<SessionMessage[]> {
  if (!postgresAvailable()) {
    return [];
  }
  return pgProfileWrap(
    "listMessages",
    () => dbListMessages(sessionId),
    {
      sessionId,
      resultBytes: (rows) => JSON.stringify(rows).length,
    },
  );
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
    return pgProfileWrap(
      "listMessagesByPosRange",
      () => dbListMessagesByPosRange(sessionId, fromPos),
      {
        sessionId,
        resultBytes: (rows) => JSON.stringify(rows).length,
      },
    );
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
  return pgProfileWrap(
    "listMessagesPage",
    () => dbListMessagesPage(sessionId, offset, limit),
    { sessionId },
  );
}

export async function countMessagesWithRouting(sessionId: string): Promise<number> {
  if (!postgresAvailable()) {
    return 0;
  }
  return dbCountMessages(sessionId);
}

export async function loadSessionToolsWithRouting(sessionId: string): Promise<SessionMetaMessage["tools"]> {
  if (!postgresAvailable()) {
    return [];
  }
  return pgProfileWrap("getSessionTools", () => dbGetSessionTools(sessionId), { sessionId });
}

export async function listSessionsWithRouting(platform?: string | null): Promise<string[]> {
  if (!postgresAvailable()) {
    return [];
  }
  return dbListSessionIds(platform);
}

export async function nextMessagePosWithRouting(sessionId: string): Promise<number> {
  if (!postgresAvailable()) {
    throw new Error("database.url 未配置");
  }
  return dbNextMessagePos(sessionId);
}

export async function pgCountSessionsByPlatform(): Promise<Record<string, number>> {
  return dbCountSessionsByPlatform();
}

export async function pgListSessionSummaries(
  platform?: string | null,
): Promise<Array<{ id: string; title: string; created: string; platform: string }>> {
  return dbListSessionSummaries(platform);
}

export async function pgDeleteDebugSessions(): Promise<number> {
  return dbDeleteDebugSessions();
}

export async function pgListDebugSessionIds(): Promise<string[]> {
  return dbListDebugSessionIds();
}

export async function pgLastMessageTimestamp(sessionId: string): Promise<string | null> {
  return dbLastMessageTimestamp(sessionId);
}

export async function pgFindSessionIdByPlatformInfo(
  platform: string,
  platformExtra: Record<string, unknown> = {},
): Promise<string | null> {
  return dbFindSessionIdByPlatformInfo(platform, platformExtra);
}

export async function pgGetSessionMeta(sessionId: string): Promise<SessionMetaMessage | null> {
  return dbGetSessionMeta(sessionId);
}

export async function pgGetSessionMetaLite(sessionId: string): Promise<SessionMetaMessage | null> {
  return dbGetSessionMetaLite(sessionId);
}

export async function pgListMessages(sessionId: string): Promise<SessionMessage[]> {
  return dbListMessages(sessionId);
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
