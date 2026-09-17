import type {
  StoredMessage,
  ConversationMetaLoadResult,
  ConversationMetaMessage,
} from "@freeanima/core/db/domain";

/** Minimal conversation meta port for capabilities (ConversationService satisfies this) */
export type ConversationPort = {
  loadConversationMeta(conversationId: string): Promise<ConversationMetaLoadResult>;
  updateConversationMetaField(
    conversationId: string,
    patch: Partial<ConversationMetaMessage> & Record<string, unknown>,
  ): Promise<void>;
  appendMessage?(msg: StoredMessage, conversationId: string): Promise<void>;
};
