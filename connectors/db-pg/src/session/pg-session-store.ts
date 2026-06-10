import type { SessionStorePort } from "@freeanima/engine-repos";
import * as messageFtsRepo from "./repos/message-fts-repo.ts";
import * as messageRepo from "./repos/message-repo.ts";
import * as sessionRepo from "./repos/session-repo.ts";

/** PostgreSQL SessionStorePort implementation */
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
  findMessagePos = messageRepo.findMessagePos;
  listMessageRowsPage = messageRepo.listMessageRowsPage;
  listMessageRowsFromPos = messageRepo.listMessageRowsFromPos;
  lastMessageTimestamp = messageRepo.lastMessageTimestamp;
  searchMessagesFts = messageFtsRepo.searchMessagesFts;
  countSearchableMessages = messageFtsRepo.countSearchableMessages;
  getSessionMetaLite = sessionRepo.getSessionMetaLite;
  getSessionTools = sessionRepo.getSessionTools;
  listMessages = messageRepo.listMessages;
  listMessagesByPosRange = messageRepo.listMessagesByPosRange;
  listMessagesPage = messageRepo.listMessagesPage;
  listSessionIdsUpdatedBetween = sessionRepo.listSessionIdsUpdatedBetween;
  getEarliestSessionDay = sessionRepo.getEarliestSessionDay;
}
