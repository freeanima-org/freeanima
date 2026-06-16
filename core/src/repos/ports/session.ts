import type {
  CompressionState,
  ConversationMessage,
  SessionMessage,
  SessionMetaMessage,
  SessionTodoStore,
} from "@freeanima/core/db/domain";

export type SessionSummaryRow = {
  id: string;
  title: string;
  created: string;
  platform: string;
};

/** PG messages FTS hit row (memory_recall / sessions_search; mapped to snippet externally) */
export type MessageFtsHit = {
  message_id: string;
  content: string;
  role: string;
  session_id: string;
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

export type SessionCleanupResult = {
  deleted: number;
  ids: string[];
};

/** Conversation Session + Message persistence port (Slice A) */
export interface SessionStorePort {
  getSessionMeta(sessionId: string): Promise<SessionMetaMessage | null>;
  getSessionMetaLite(sessionId: string): Promise<SessionMetaMessage | null>;
  getSessionTools(sessionId: string): Promise<SessionMetaMessage["tools"]>;
  upsertSessionMeta(sessionId: string, meta: SessionMetaMessage): Promise<void>;
  patchSessionMeta(
    sessionId: string,
    patch: Partial<SessionMetaMessage> & Record<string, unknown>,
  ): Promise<void>;
  updateCompression(sessionId: string, compression: CompressionState): Promise<void>;
  updateTodos(sessionId: string, todos: SessionTodoStore): Promise<void>;
  appendMessage(sessionId: string, msg: SessionMessage): Promise<ConversationMessage>;
  appendMessageReturningId(sessionId: string, msg: SessionMessage): Promise<{ messageId: string }>;
  getMessageContentById(sessionId: string, messageId: string): Promise<string | null>;
  updateMessageContent(sessionId: string, messageId: string, content: string): Promise<void>;
  nextMessagePos(sessionId: string): Promise<number>;
  listMessages(sessionId: string): Promise<ConversationMessage[]>;
  listMessagesByPosRange(
    sessionId: string,
    fromPos: number,
    toPos?: number,
  ): Promise<ConversationMessage[]>;
  listMessagesPage(
    sessionId: string,
    offset: number,
    limit: number,
  ): Promise<ConversationMessage[]>;
  countMessages(sessionId: string): Promise<number>;
  /** Look up in-session pos by PG primary key (scroll anchor) */
  findMessagePos(sessionId: string, messageId: string): Promise<number | null>;
  /** Paginate by pos order; return LLM-readable rows with message_id */
  listMessageRowsPage(sessionId: string, offset: number, limit: number): Promise<MessageRowView[]>;
  /** Read limit messages from pos onward (message_id anchor scroll) */
  listMessageRowsFromPos(
    sessionId: string,
    fromPos: number,
    limit: number,
  ): Promise<MessageRowView[]>;
  lastMessageTimestamp(sessionId: string): Promise<string | null>;
  truncateMessagesAfter(sessionId: string, keepThroughPos: number): Promise<void>;
  shiftMessagePositions(sessionId: string, afterPos: number, delta: number): Promise<void>;
  sessionExists(sessionId: string): Promise<boolean>;
  deleteSession(sessionId: string): Promise<void>;
  listSessionIds(platform?: string | null): Promise<string[]>;
  listDebugSessionIds(): Promise<string[]>;
  listSessionSummaries(platform?: string | null): Promise<SessionSummaryRow[]>;
  countSessionsByPlatform(): Promise<Record<string, number>>;
  deleteDebugSessions(): Promise<number>;
  findSessionIdByPlatformInfo(
    platform: string,
    platformExtra?: Record<string, unknown>,
  ): Promise<string | null>;
  /** PG messages.content_fts full-text search (user/assistant readable content only) */
  searchMessagesFts(
    query: string,
    opts?: { sessionId?: string; limit?: number },
  ): Promise<MessageFtsHit[]>;
  /** Message row count indexable by FTS (content_fts IS NOT NULL) */
  countSearchableMessages(): Promise<number>;
  /** Session ids with sessions.updated_at in [fromIso, toIso) (excludes debug) */
  listSessionIdsUpdatedBetween(fromIso: string, toIso: string): Promise<string[]>;
  /** Earliest non-debug session CST calendar day YYYY-MM-DD; null if none */
  getEarliestSessionDay(): Promise<string | null>;
  /** Stale session ids eligible for nightly cleanup (see runtime cleanupStaleSessions) */
  listStaleSessionIdsForCleanup(opts: { olderThan: Date }): Promise<string[]>;
  deleteStaleSessions(opts: { olderThan: Date }): Promise<SessionCleanupResult>;
}
