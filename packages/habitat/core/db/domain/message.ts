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
export type {
  MessageAttachmentMeta,
  MessageContentMedia,
} from "@freeanima/shared/pg-shapes/jsonb/message-payload.ts";

const posField = { pos: z.number().optional() };

export const userMessageSchema = userPayloadSchema.extend(posField);
export const systemMessageSchema = systemPayloadSchema.extend(posField);
export const assistantMessageSchema = assistantPayloadSchema.extend(posField);
export const toolMessageSchema = toolPayloadSchema.extend(posField);

/** Conversation messages (user/system/assistant/tool) — excludes conversation meta */
export const conversationMessageSchema = z.discriminatedUnion("role", [
  userMessageSchema,
  systemMessageSchema,
  assistantMessageSchema,
  toolMessageSchema,
]);

/** PG messages.payload */
export const conversationPayloadSchema = messagePayloadSchema;

/** Stored / in-memory transcript messages (same as conversationMessageSchema) */
export const storedMessageSchema = conversationMessageSchema;

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationPayload = MessagePayload;

export type OpenAiFunctionSchema = z.infer<typeof openAiFunctionSchema>;
export type MessageUsage = z.infer<typeof messageUsageSchema>;
export type UserMessage = z.infer<typeof userMessageSchema>;
export type SystemMessage = z.infer<typeof systemMessageSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type ToolMessage = z.infer<typeof toolMessageSchema>;
export type StoredMessage = z.infer<typeof storedMessageSchema>;

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
