import { conversationPayloadSchema, type ConversationPayload } from "@freeanima/kernel-schemas";
export type {
  LlmTurnMessage,
  MessagePayload,
  OpenAiToolSchema,
  ToolCall,
} from "@freeanima/engine-provider-llm";

/** messages.payload — kernel ConversationMessage 去掉 pos（pos 由列维护） */
export const messagePayloadSchema = conversationPayloadSchema;
export type { ConversationPayload };
