import type { ConversationStorePort } from "../ports/conversation.ts";

import { pgUnavailable } from "./null-helpers.ts";

const unavailable = pgUnavailable;

/** Null Conversation port when PG unavailable */
export const nullConversationStore: ConversationStorePort = {
  async getConversationMeta() {
    return null;
  },
  async getConversationMetaLite() {
    return null;
  },
  async getConversationTools() {
    return [];
  },
  async upsertConversationMeta() {
    return;
  },
  async patchConversationMeta() {
    return;
  },
  async updateCompression() {
    return;
  },
  async updateTodos() {
    return;
  },
  async appendMessage(..._args: Parameters<ConversationStorePort["appendMessage"]>) {
    return unavailable();
  },
  async appendMessageReturningId(
    ..._args: Parameters<ConversationStorePort["appendMessageReturningId"]>
  ) {
    return unavailable();
  },
  async getMessageContentById(
    ..._args: Parameters<ConversationStorePort["getMessageContentById"]>
  ) {
    return unavailable();
  },
  async updateMessageContent(..._args: Parameters<ConversationStorePort["updateMessageContent"]>) {
    return unavailable();
  },
  async nextMessagePos(..._args: Parameters<ConversationStorePort["nextMessagePos"]>) {
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
  async conversationExists() {
    return false;
  },
  async deleteConversation() {
    return;
  },
  async archiveConversation() {
    return;
  },
  async unarchiveConversation() {
    return;
  },
  async listConversationIds() {
    return [];
  },
  async listDebugConversationIds() {
    return [];
  },
  async listConversationSummaries() {
    return [];
  },
  async listConversationSummariesPage() {
    return { items: [], total: 0 };
  },
  async getMessageContentsByIds() {
    return {};
  },
  async countConversationsByPlatform() {
    return {};
  },
  async deleteDebugConversations() {
    return 0;
  },
  async findConversationIdByPlatformInfo() {
    return null;
  },
  async listConversationIdsMatchingPlatformProbe() {
    return [];
  },
  async searchMessagesFts() {
    return [];
  },
  async countSearchableMessages() {
    return 0;
  },
  async listConversationIdsUpdatedBetween() {
    return [];
  },
  async getEarliestConversationDay() {
    return null;
  },
  async listStaleConversationIdsForCleanup() {
    return [];
  },
  async deleteStaleConversations() {
    return { deleted: 0, ids: [] };
  },
};
