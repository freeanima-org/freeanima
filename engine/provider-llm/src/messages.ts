import type { ConversationPayload, OpenAiToolSchema, ToolCall } from "@freeanima/kernel-schemas";

/** messages.payload — ConversationMessage 去掉 pos（pos 由列维护） */
export type MessagePayload = ConversationPayload;

/** LLM invoke 对话轮次（不含 system；系统提示词单独传入） */
export type LlmTurnMessage =
  | Extract<MessagePayload, { role: "user" }>
  | Extract<MessagePayload, { role: "assistant" }>
  | Extract<MessagePayload, { role: "tool" }>;

export type { OpenAiToolSchema, ToolCall };
