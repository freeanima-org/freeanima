import type { SessionStorePort } from "@freeanima/kernel";
import { pgProfileWrap } from "../pg-profile.ts";
import * as messageRepo from "./repos/message-repo.ts";
import * as sessionRepo from "./repos/session-repo.ts";

/** PostgreSQL SessionStorePort 实现 */
export class PgSessionStore implements SessionStorePort {
  getSessionMeta = sessionRepo.getSessionMeta;
  upsertSessionMeta = sessionRepo.upsertSessionMeta;
  patchSessionMeta = sessionRepo.patchSessionMeta;
  updateCompression = sessionRepo.updateCompression;
  updateTodos = sessionRepo.updateTodos;
  appendMessage = messageRepo.appendMessage;
  nextMessagePos = messageRepo.nextMessagePos;
  truncateMessagesAfter = messageRepo.truncateMessagesAfter;
  shiftMessagePositions = messageRepo.shiftMessagePositions;
  sessionExists = sessionRepo.sessionExists;
  deleteSession = sessionRepo.deleteSession;
  listSessionIds = sessionRepo.listSessionIds;
  listDebugSessionIds = sessionRepo.listDebugSessionIds;
  listSessionSummaries = sessionRepo.listSessionSummaries;
  countSessionsByPlatform = sessionRepo.countSessionsByPlatform;
  deleteDebugSessions = sessionRepo.deleteDebugSessions;
  findSessionIdByPlatformInfo = sessionRepo.findSessionIdByPlatformInfo;
  countMessages = messageRepo.countMessages;
  lastMessageTimestamp = messageRepo.lastMessageTimestamp;

  async getSessionMetaLite(sessionId: string) {
    return pgProfileWrap("getSessionMetaLite", () => sessionRepo.getSessionMetaLite(sessionId), {
      sessionId,
    });
  }

  async getSessionTools(sessionId: string) {
    return pgProfileWrap("getSessionTools", () => sessionRepo.getSessionTools(sessionId), {
      sessionId,
    });
  }

  async listMessages(sessionId: string) {
    return pgProfileWrap("listMessages", () => messageRepo.listMessages(sessionId), {
      sessionId,
      resultBytes: (rows) => JSON.stringify(rows).length,
    });
  }

  async listMessagesByPosRange(sessionId: string, fromPos: number, toPos?: number) {
    return pgProfileWrap(
      "listMessagesByPosRange",
      () => messageRepo.listMessagesByPosRange(sessionId, fromPos, toPos),
      {
        sessionId,
        resultBytes: (rows) => JSON.stringify(rows).length,
      },
    );
  }

  async listMessagesPage(sessionId: string, offset: number, limit: number) {
    return pgProfileWrap(
      "listMessagesPage",
      () => messageRepo.listMessagesPage(sessionId, offset, limit),
      { sessionId },
    );
  }
}
