import {
  conversationPayloadSchema,
  type ConversationPayload,
  type LlmTurnMessage,
  type MessagePayload,
  type OpenAiToolSchema,
  type ToolCall,
} from "@freeanima/kernel-schemas";

export type { LlmTurnMessage, MessagePayload, OpenAiToolSchema, ToolCall };

/** messages.payload — kernel ConversationMessage 去掉 pos（pos 由列维护） */
export const messagePayloadSchema = conversationPayloadSchema;
export type { ConversationPayload };
