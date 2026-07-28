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
  conversationTodoStoreSchema,
} from "./conversation-meta.ts";
export { openAiToolSchema, toolCallSchema, messagePayloadSchema, type MessagePayload };
export type { LlmTurnMessage, OpenAiToolSchema, ToolCall } from "../schema/index.ts";

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

/** Conversation messages (excludes conversation_meta) for compressor / LLM */
export const conversationMessageSchema = conversationRoles;

/** PG messages.payload */
export const conversationPayloadSchema = messagePayloadSchema;

export const conversationMetaSchema = z
  .object({
    role: z.literal("conversation_meta"),
    model: z.string(),
    cached_toolsets: z.array(z.string()).default([]),
    staged_toolsets: z.array(z.string()).optional(),
    functions: z.array(z.string()).default([]),
    timestamp: z.string().default(""),
    platform: z.string().optional(),
    system_prompt: z.string().optional(),
    /** ISO timestamptz；上次全量构建 system_prompt（日界刷新用） */
    system_prompt_built_at: z.string().optional(),
    cwd: z.string().optional(),
    title: z.string().optional(),
    compression: z.unknown().optional(),
    platform_extra: z.record(z.string(), z.unknown()).optional(),
    debug: z.boolean().optional(),
    todos: z.unknown().optional(),
    awaiting_clarify: z.unknown().optional(),
    acp_tasks: z.record(z.string(), z.unknown()).optional(),
    acp_tasks_handled_at: z.string().optional(),
    gateway_tool_display: z.string().optional(),
    goal: z.unknown().optional(),
  })
  .passthrough();

export const storedMessageSchema = z.discriminatedUnion("role", [
  conversationMetaSchema,
  userMessageSchema,
  systemMessageSchema,
  assistantMessageSchema,
  toolMessageSchema,
]);

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationPayload = MessagePayload;

export type OpenAiFunctionSchema = z.infer<typeof openAiFunctionSchema>;
export type MessageUsage = z.infer<typeof messageUsageSchema>;
export type ConversationMetaMessage = z.infer<typeof conversationMetaSchema>;
export type UserMessage = z.infer<typeof userMessageSchema>;
export type SystemMessage = z.infer<typeof systemMessageSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type ToolMessage = z.infer<typeof toolMessageSchema>;
export type StoredMessage = z.infer<typeof storedMessageSchema>;

export type ConversationMetaLoadResult = ConversationMetaMessage | Record<string, never>;

export function isConversationMeta(
  meta: ConversationMetaLoadResult,
): meta is ConversationMetaMessage {
  return meta.role === "conversation_meta";
}

export function isUserMessage(msg: StoredMessage): msg is UserMessage {
  return msg.role === "user";
}

export function isAssistantMessage(msg: StoredMessage): msg is AssistantMessage {
  return msg.role === "assistant";
}

export function isToolMessage(msg: StoredMessage): msg is ToolMessage {
  return msg.role === "tool";
}

export function isSystemMessage(msg: StoredMessage): msg is SystemMessage {
  return msg.role === "system";
}

export { awaitingClarifySchema, compressionStateSchema, conversationTodoStoreSchema };
