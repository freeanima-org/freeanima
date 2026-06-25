import type {
  CompressionState,
  ConversationMessage,
  StoredMessage,
  ConversationMetaMessage,
  ConversationTodoStore,
} from "@freeanima/core/db/domain";

export type ConversationSummaryRow = {
  id: string;
  title: string;
  created: string;
  platform: string;
  archived_at?: string | null;
};

export type ConversationListOpts = {
  platform?: string | null;
  includeArchived?: boolean;
};

/** PG messages FTS hit row (memory_recall / conversation_search; mapped to snippet externally) */
export type MessageFtsHit = {
  message_id: string;
  content: string;
  role: string;
  conversation_id: string;
  timestamp: string;
  rank: number;
};

/** LLM-tool-readable message row view (includes PG primary key) */
export type MessageRowView = {
  message_id: string;
  pos: number;
  role: string;
  content: string;
  timestamp: string;
};

export type ConversationCleanupResult = {
  deleted: number;
  ids: string[];
};

/** Conversation + Message persistence port (Slice A) */
export interface ConversationStorePort {
  getConversationMeta(conversationId: string): Promise<ConversationMetaMessage | null>;
  getConversationMetaLite(conversationId: string): Promise<ConversationMetaMessage | null>;
  getConversationTools(conversationId: string): Promise<ConversationMetaMessage["cached_toolsets"]>;
  upsertConversationMeta(conversationId: string, meta: ConversationMetaMessage): Promise<void>;
  patchConversationMeta(
    conversationId: string,
    patch: Partial<ConversationMetaMessage> & Record<string, unknown>,
  ): Promise<void>;
  updateCompression(conversationId: string, compression: CompressionState): Promise<void>;
  updateTodos(conversationId: string, todos: ConversationTodoStore): Promise<void>;
  appendMessage(conversationId: string, msg: StoredMessage): Promise<ConversationMessage>;
  appendMessageReturningId(
    conversationId: string,
    msg: StoredMessage,
  ): Promise<{ messageId: string }>;
  getMessageContentById(conversationId: string, messageId: string): Promise<string | null>;
  updateMessageContent(conversationId: string, messageId: string, content: string): Promise<void>;
  nextMessagePos(conversationId: string): Promise<number>;
  listMessages(conversationId: string): Promise<ConversationMessage[]>;
  listMessagesByPosRange(
    conversationId: string,
    fromPos: number,
    toPos?: number,
  ): Promise<ConversationMessage[]>;
  listMessagesPage(
    conversationId: string,
    offset: number,
    limit: number,
  ): Promise<ConversationMessage[]>;
  countMessages(conversationId: string): Promise<number>;
  countUserMessages(conversationId: string): Promise<number>;
  /** Look up in-conversation pos by PG primary key (scroll anchor) */
  findMessagePos(conversationId: string, messageId: string): Promise<number | null>;
  /** Paginate by pos order; return LLM-readable rows with message_id */
  listMessageRowsPage(
    conversationId: string,
    offset: number,
    limit: number,
  ): Promise<MessageRowView[]>;
  /** Read limit messages from pos onward (message_id anchor scroll) */
  listMessageRowsFromPos(
    conversationId: string,
    fromPos: number,
    limit: number,
  ): Promise<MessageRowView[]>;
  lastMessageTimestamp(conversationId: string): Promise<string | null>;
  truncateMessagesAfter(conversationId: string, keepThroughPos: number): Promise<void>;
  shiftMessagePositions(conversationId: string, afterPos: number, delta: number): Promise<void>;
  conversationExists(conversationId: string): Promise<boolean>;
  deleteConversation(conversationId: string): Promise<void>;
  archiveConversation(conversationId: string): Promise<void>;
  unarchiveConversation(conversationId: string): Promise<void>;
  listConversationIds(
    platform?: string | null,
    opts?: Pick<ConversationListOpts, "includeArchived">,
  ): Promise<string[]>;
  listDebugConversationIds(): Promise<string[]>;
  listConversationSummaries(
    platform?: string | null,
    opts?: Pick<ConversationListOpts, "includeArchived">,
  ): Promise<ConversationSummaryRow[]>;
  listConversationSummariesPage(opts?: ConversationListOpts & {
    offset?: number;
    limit?: number;
  }): Promise<{ items: ConversationSummaryRow[]; total: number }>;
  getMessageContentsByIds(
    conversationId: string,
    messageIds: string[],
  ): Promise<Record<string, string>>;
  countConversationsByPlatform(): Promise<Record<string, number>>;
  deleteDebugConversations(): Promise<number>;
  findConversationIdByPlatformInfo(
    platform: string,
    platformExtra?: Record<string, unknown>,
  ): Promise<string | null>;
  listConversationIdsMatchingPlatformProbe(
    platform: string,
    platformExtra?: Record<string, unknown>,
  ): Promise<string[]>;
  /** PG messages.content_fts full-text search (user/assistant readable content only) */
  searchMessagesFts(
    query: string,
    opts?: { conversationId?: string; limit?: number },
  ): Promise<MessageFtsHit[]>;
  /** Message row count indexable by FTS (content_fts IS NOT NULL) */
  countSearchableMessages(): Promise<number>;
  /** Session ids with conversations.updated_at in [fromIso, toIso) (excludes debug) */
  listConversationIdsUpdatedBetween(fromIso: string, toIso: string): Promise<string[]>;
  /** Earliest non-debug conversation CST calendar day YYYY-MM-DD; null if none */
  getEarliestConversationDay(): Promise<string | null>;
  /** Stale conversation ids eligible for nightly cleanup (see runtime cleanupStaleConversations) */
  listStaleConversationIdsForCleanup(opts: { olderThan: Date }): Promise<string[]>;
  deleteStaleConversations(opts: { olderThan: Date }): Promise<ConversationCleanupResult>;
}
