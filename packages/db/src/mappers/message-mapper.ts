import { randomUUID } from "node:crypto";

import {
  type ConversationMessage,
  conversationMessageSchema,
  type SessionMessage,
  isAssistantMessage,
  isToolMessage,
  isUserMessage,
} from "@freeanima/kernel";

import {
  isMessageRole,
  rolePayloadSchema,
  type RolePayload,
} from "../schema/jsonb/role-payload.js";
import {
  type MessageInsert,
  messageSelectSchema,
} from "../schema/zod-schemas.js";
import { normalizePgTimestamp } from "../utils/timestamp.js";

export function newMessageGlobalId(): string {
  return randomUUID();
}

function sessionMessageToRolePayload(msg: SessionMessage): RolePayload {
  if (isUserMessage(msg)) {
    return rolePayloadSchema.parse({
      role: "user",
      ...(msg.name !== undefined ? { name: msg.name } : {}),
    });
  }
  if (isAssistantMessage(msg)) {
    return rolePayloadSchema.parse({
      role: "assistant",
      ...(msg.name !== undefined ? { name: msg.name } : {}),
      ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}),
      ...(msg.model !== undefined ? { model: msg.model } : {}),
      ...(msg.finish_reason !== undefined ? { finish_reason: msg.finish_reason } : {}),
      ...(msg.reasoning !== undefined ? { reasoning: msg.reasoning } : {}),
      ...(msg.reasoning_content !== undefined
        ? { reasoning_content: msg.reasoning_content }
        : {}),
      ...(msg.usage !== undefined ? { usage: msg.usage } : {}),
      ...(msg.latency_ms !== undefined ? { latency_ms: msg.latency_ms } : {}),
    });
  }
  if (isToolMessage(msg)) {
    return rolePayloadSchema.parse({
      role: "tool",
      tool_call_id: msg.tool_call_id,
      ...(msg.name !== undefined ? { name: msg.name } : {}),
    });
  }
  throw new Error(`messages 表不支持的 role: ${(msg as SessionMessage).role}`);
}

/** 领域消息 → PG insert 行（不含 session_meta / system） */
export function messageToInsert(sessionId: string, msg: SessionMessage): MessageInsert {
  if (msg.role === "session_meta") {
    throw new Error("session_meta 不能写入 messages 表");
  }
  if (msg.role === "system") {
    throw new Error("system 消息不写入 messages 表（见 sessions.system_prompt）");
  }
  if (!isMessageRole(msg.role)) {
    throw new Error(`messages 表不支持的 role: ${msg.role}`);
  }
  if (msg.id === undefined) {
    throw new Error("messages 写入需要 pos（JSONL id）");
  }
  return {
    id: newMessageGlobalId(),
    sessionId,
    pos: msg.id,
    content: String(msg.content ?? ""),
    ts: normalizePgTimestamp(msg.timestamp ?? new Date().toISOString()),
    rolePayload: sessionMessageToRolePayload(msg),
  };
}

/** PG 行 → 领域对话消息（`id` 投影为 session 内 pos，与 JSONL 一致） */
export function rowToMessage(row: unknown): ConversationMessage {
  const parsed = messageSelectSchema.parse(row);
  const base = {
    id: Number(parsed.pos),
    content: parsed.content,
    timestamp: parsed.ts,
    ...parsed.rolePayload,
  };
  return conversationMessageSchema.parse(base);
}
