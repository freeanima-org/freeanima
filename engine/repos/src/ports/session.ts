import type {
  CompressionState,
  ConversationMessage,
  SessionMessage,
  SessionMetaMessage,
  SessionTodoStore,
} from "@freeanima/engine-db/domain";

export type SessionSummaryRow = {
  id: string;
  title: string;
  created: string;
  platform: string;
};

/** PG messages FTS 命中行（recall / memorySearch L2 段） */
export type MessageFtsHit = {
  content: string;
  role: string;
  session_id: string;
  timestamp: string;
  rank: number;
};

/** L1 Session + Message 持久化端口（Slice A） */
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
  /** PG messages.content_fts 全文检索（仅 user/assistant 可读 content） */
  searchMessagesFts(
    query: string,
    opts?: { sessionId?: string; limit?: number },
  ): Promise<MessageFtsHit[]>;
  /** 可被 FTS 索引的消息行数（content_fts IS NOT NULL） */
  countSearchableMessages(): Promise<number>;
  /** sessions.updated_at 落在 [fromIso, toIso) 内的 session id（不含 debug） */
  listSessionIdsUpdatedBetween(fromIso: string, toIso: string): Promise<string[]>;
}
