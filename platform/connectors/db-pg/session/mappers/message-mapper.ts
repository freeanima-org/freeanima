import { randomUUID } from "node:crypto";

import {
  conversationMessageSchema,
  conversationPayloadSchema,
  isAssistantMessage,
  isToolMessage,
  isUserMessage,
  type ConversationMessage,
  type SessionMessage,
} from "@freeanima/core/db/domain";

import { type MessageInsert, messageSelectSchema } from "@freeanima/core/db/schema";

export function newMessageGlobalId(): string {
  return randomUUID();
}

function assertConversationMessage(msg: SessionMessage): ConversationMessage {
  if (msg.role === "session_meta") {
    throw new Error("session_meta cannot be written to messages table");
  }
  if (msg.role === "system") {
    throw new Error("system messages not written to messages table (see sessions.system_prompt)");
  }
  if (!isUserMessage(msg) && !isAssistantMessage(msg) && !isToolMessage(msg)) {
    throw new Error(`Unsupported role for messages table: ${(msg as SessionMessage).role}`);
  }
  if (msg.pos === undefined) {
    throw new Error("messages write requires pos");
  }
  return conversationMessageSchema.parse(msg);
}

function toPayload(msg: ConversationMessage): MessageInsert["payload"] {
  const { pos: _pos, ...rest } = msg;
  return conversationPayloadSchema.parse(rest);
}

/** Domain message → PG insert row */
export function messageToInsert(sessionId: string, msg: SessionMessage): MessageInsert {
  const parsed = assertConversationMessage(msg);
  return {
    id: newMessageGlobalId(),
    sessionId,
    pos: parsed.pos!,
    payload: toPayload(parsed),
  };
}

/** PG row → domain Conversation messages (pos column is source of truth) */
export function rowToMessage(row: unknown): ConversationMessage {
  const parsed = messageSelectSchema.parse(row);
  return conversationMessageSchema.parse({
    ...parsed.payload,
    pos: Number(parsed.pos),
  });
}
