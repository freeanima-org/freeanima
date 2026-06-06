import type {
  CompressionState,
  ConversationMessage,
  SessionMessage,
  SessionMetaMessage,
  SessionTodoStore,
} from "@freeanima/kernel-schemas";

export type SessionSummaryRow = {
  id: string;
  title: string;
  created: string;
  platform: string;
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
}
