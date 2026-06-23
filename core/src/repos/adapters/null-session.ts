import type { SessionStorePort } from "../ports/session.ts";

import { pgUnavailable } from "./null-helpers.ts";

const unavailable = pgUnavailable;

/** Null Session port when PG unavailable */
export const nullSessionStore: SessionStorePort = {
  async getSessionMeta() {
    return null;
  },
  async getSessionMetaLite() {
    return null;
  },
  async getSessionTools() {
    return [];
  },
  async upsertSessionMeta() {
    return;
  },
  async patchSessionMeta() {
    return;
  },
  async updateCompression() {
    return;
  },
  async updateTodos() {
    return;
  },
  async appendMessage(..._args: Parameters<SessionStorePort["appendMessage"]>) {
    return unavailable();
  },
  async appendMessageReturningId(
    ..._args: Parameters<SessionStorePort["appendMessageReturningId"]>
  ) {
    return unavailable();
  },
  async getMessageContentById(..._args: Parameters<SessionStorePort["getMessageContentById"]>) {
    return unavailable();
  },
  async updateMessageContent(..._args: Parameters<SessionStorePort["updateMessageContent"]>) {
    return unavailable();
  },
  async nextMessagePos(..._args: Parameters<SessionStorePort["nextMessagePos"]>) {
    return unavailable();
  },
  async listMessages() {
    return [];
  },
  async listMessagesByPosRange() {
    return [];
  },
  async listMessagesPage() {
    return [];
  },
  async countMessages() {
    return 0;
  },
  async countUserMessages() {
    return 0;
  },
  async findMessagePos() {
    return null;
  },
  async listMessageRowsPage() {
    return [];
  },
  async listMessageRowsFromPos() {
    return [];
  },
  async lastMessageTimestamp() {
    return null;
  },
  async truncateMessagesAfter() {
    return;
  },
  async shiftMessagePositions() {
    return;
  },
  async sessionExists() {
    return false;
  },
  async deleteSession() {
    return;
  },
  async listSessionIds() {
    return [];
  },
  async listDebugSessionIds() {
    return [];
  },
  async listSessionSummaries() {
    return [];
  },
  async listSessionSummariesPage() {
    return { items: [], total: 0 };
  },
  async getMessageContentsByIds() {
    return {};
  },
  async countSessionsByPlatform() {
    return {};
  },
  async deleteDebugSessions() {
    return 0;
  },
  async findSessionIdByPlatformInfo() {
    return null;
  },
  async listSessionIdsMatchingPlatformProbe() {
    return [];
  },
  async searchMessagesFts() {
    return [];
  },
  async countSearchableMessages() {
    return 0;
  },
  async listSessionIdsUpdatedBetween() {
    return [];
  },
  async getEarliestSessionDay() {
    return null;
  },
  async listStaleSessionIdsForCleanup() {
    return [];
  },
  async deleteStaleSessions() {
    return { deleted: 0, ids: [] };
  },
};
