import type {
  SessionMessage,
  SessionMetaLoadResult,
  SessionMetaMessage,
} from "@freeanima/storage-db/domain";

/** Minimal session meta port for capabilities (ConversationService satisfies this) */
export type SessionConversationPort = {
  loadSessionMeta(session: string): Promise<SessionMetaLoadResult>;
  updateSessionMetaField(
    session: string,
    patch: Partial<SessionMetaMessage> & Record<string, unknown>,
  ): Promise<void>;
  appendMessage?(msg: SessionMessage, session: string): Promise<void>;
};
