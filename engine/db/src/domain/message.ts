import { z } from "zod";

import {
  assistantPayloadSchema,
  messagePayloadSchema,
  messageUsageSchema,
  openAiFunctionSchema,
  openAiToolSchema,
  toolCallSchema,
  toolPayloadSchema,
  userPayloadSchema,
  systemPayloadSchema,
  type MessagePayload,
} from "../schema/index.ts";
import {
  awaitingClarifySchema,
  compressionStateSchema,
  sessionTodoStoreSchema,
} from "./session-meta.ts";
import { parseJsonLine } from "@freeanima/kernel-util";

export { openAiToolSchema, toolCallSchema, messagePayloadSchema, type MessagePayload };
export type { LlmTurnMessage, OpenAiToolSchema, ToolCall } from "../schema/index.ts";

/** 兼容旧 JSONL / payload 中的 id 字段 → pos */
export function normalizeLegacyMessagePos(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (o.pos === undefined && typeof o.id === "number") {
    o.pos = o.id;
  }
  delete o.id;
  return o;
}

const posField = { pos: z.number().optional() };

export const userMessageSchema = userPayloadSchema.extend(posField);
export const systemMessageSchema = systemPayloadSchema.extend(posField);
export const assistantMessageSchema = assistantPayloadSchema.extend(posField);
export const toolMessageSchema = toolPayloadSchema.extend(posField);

const conversationRoles = z.discriminatedUnion("role", [
  userMessageSchema,
  systemMessageSchema,
  assistantMessageSchema,
  toolMessageSchema,
]);

/** 对话消息（不含 session_meta），供 compressor / LLM 使用 */
export const conversationMessageSchema = conversationRoles;

/** PG messages.payload — 与 kernel-db 存储 schema 一致 */
export const conversationPayloadSchema = messagePayloadSchema;

export const sessionMetaSchema = z
  .object({
    role: z.literal("session_meta"),
    model: z.string(),
    tools: z.array(z.string()).default([]),
    functions: z.array(z.string()).default([]),
    timestamp: z.string().default(""),
    platform: z.string().optional(),
    system_prompt: z.string().optional(),
    cwd: z.string().optional(),
    title: z.string().optional(),
    compression: z.unknown().optional(),
    platform_extra: z.record(z.string(), z.unknown()).optional(),
    debug: z.boolean().optional(),
    todos: z.unknown().optional(),
    awaiting_clarify: z.unknown().optional(),
    acp_sessions: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export const sessionMessageSchema = z.preprocess(
  normalizeLegacyMessagePos,
  z.discriminatedUnion("role", [
    sessionMetaSchema,
    userMessageSchema,
    systemMessageSchema,
    assistantMessageSchema,
    toolMessageSchema,
  ]),
);

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationPayload = MessagePayload;

export type OpenAiFunctionSchema = z.infer<typeof openAiFunctionSchema>;
export type MessageUsage = z.infer<typeof messageUsageSchema>;
export type SessionMetaMessage = z.infer<typeof sessionMetaSchema>;
export type UserMessage = z.infer<typeof userMessageSchema>;
export type SystemMessage = z.infer<typeof systemMessageSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type ToolMessage = z.infer<typeof toolMessageSchema>;
export type SessionMessage = z.infer<typeof sessionMessageSchema>;

export type SessionMetaLoadResult = SessionMetaMessage | Record<string, never>;

/** 解析 JSONL 单行；无效行返回 null */
export function parseSessionLine(line: string): SessionMessage | null {
  return parseJsonLine(line, sessionMessageSchema);
}

export function isSessionMeta(meta: SessionMetaLoadResult): meta is SessionMetaMessage {
  return meta.role === "session_meta";
}

export function isUserMessage(msg: SessionMessage): msg is UserMessage {
  return msg.role === "user";
}

export function isAssistantMessage(msg: SessionMessage): msg is AssistantMessage {
  return msg.role === "assistant";
}

export function isToolMessage(msg: SessionMessage): msg is ToolMessage {
  return msg.role === "tool";
}

export function isSystemMessage(msg: SessionMessage): msg is SystemMessage {
  return msg.role === "system";
}

export { awaitingClarifySchema, compressionStateSchema, sessionTodoStoreSchema };
