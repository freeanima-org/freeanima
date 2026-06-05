import { randomUUID } from "node:crypto";

import {
  type ConversationMessage,
  conversationMessageSchema,
  conversationPayloadSchema,
  type SessionMessage,
  isAssistantMessage,
  isToolMessage,
  isUserMessage,
} from "@freeanima/legacy-kernel";

import { type MessageInsert, messageSelectSchema } from "../schema/zod-schemas.ts";

export function newMessageGlobalId(): string {
  return randomUUID();
}

function assertConversationMessage(msg: SessionMessage): ConversationMessage {
  if (msg.role === "session_meta") {
    throw new Error("session_meta 不能写入 messages 表");
  }
  if (msg.role === "system") {
    throw new Error("system 消息不写入 messages 表（见 sessions.system_prompt）");
  }
  if (!isUserMessage(msg) && !isAssistantMessage(msg) && !isToolMessage(msg)) {
    throw new Error(`messages 表不支持的 role: ${(msg as SessionMessage).role}`);
  }
  if (msg.pos === undefined) {
    throw new Error("messages 写入需要 pos");
  }
  return conversationMessageSchema.parse(msg);
}

function toPayload(msg: ConversationMessage): MessageInsert["payload"] {
  const { pos: _pos, ...rest } = msg;
  return conversationPayloadSchema.parse(rest);
}

/** 领域消息 → PG insert 行 */
export function messageToInsert(sessionId: string, msg: SessionMessage): MessageInsert {
  const parsed = assertConversationMessage(msg);
  return {
    id: newMessageGlobalId(),
    sessionId,
    pos: parsed.pos!,
    payload: toPayload(parsed),
  };
}

/** PG 行 → 领域对话消息（pos 列是唯一真相源） */
export function rowToMessage(row: unknown): ConversationMessage {
  const parsed = messageSelectSchema.parse(row);
  return conversationMessageSchema.parse({
    ...parsed.payload,
    pos: Number(parsed.pos),
  });
}
