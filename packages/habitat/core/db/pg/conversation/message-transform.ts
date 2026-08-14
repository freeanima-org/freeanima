import { randomUUID } from "node:crypto";

import {
  conversationMessageSchema,
  conversationPayloadSchema,
  isAssistantMessage,
  isToolMessage,
  isUserMessage,
  type ConversationMessage,
  type StoredMessage,
} from "@freeanima/habitat/core/db/domain";

import { type MessageInsert, messageSelectSchema } from "@freeanima/habitat/core/db/schema";

export function newMessageGlobalId(): string {
  return randomUUID();
}

function assertConversationMessage(msg: StoredMessage): ConversationMessage {
  if (msg.role === "system") {
    throw new Error("system messages not written to messages table (see sessions.system_prompt)");
  }
  if (!isUserMessage(msg) && !isAssistantMessage(msg) && !isToolMessage(msg)) {
    throw new Error(`Unsupported role for messages table: ${(msg as StoredMessage).role}`);
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
export function messageToInsert(conversation_id: string, msg: StoredMessage): MessageInsert {
  const parsed = assertConversationMessage(msg);
  const pos = parsed.pos;
  if (pos === undefined) throw new Error("message pos is required for insert");
  return {
    id: newMessageGlobalId(),
    conversation_id,
    pos,
    payload: toPayload(parsed),
  };
}

/** PG row → domain Conversation messages (pos column is source of truth) */
export function rowToMessage(row: unknown): ConversationMessage {
  const parsed = messageSelectSchema.parse(row);
  return conversationMessageSchema.parse({
    ...parsed.payload,
    pos: parsed.pos,
  });
}
