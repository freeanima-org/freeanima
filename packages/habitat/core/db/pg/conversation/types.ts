import type {
  CompressionState,
  ConversationMessage,
  StoredMessage,
  ConversationMetaMessage,
  ConversationTodoStore,
} from "@freeanima/habitat/core/db/domain";

export type ConversationSummaryRow = {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  platform: string;
  archived_at?: Date | null;
  /** 置顶时间；非空表示已置顶 */
  pinned_at?: Date | null;
  /** 用户未读：存在 pos > last_read_pos 的 assistant 消息 */
  unread?: boolean;
};

export type ConversationListOpts = {
  platform?: string | null;
  includeArchived?: boolean;
};

/** PG messages FTS hit row (conversation_search / Habitat scoped search; mapped to snippet externally) */
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

export type {
  CompressionState,
  ConversationMessage,
  StoredMessage,
  ConversationMetaMessage,
  ConversationTodoStore,
};
