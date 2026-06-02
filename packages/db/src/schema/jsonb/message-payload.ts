import { conversationPayloadSchema, type ConversationPayload } from "@freeanima/legacy-kernel";

/** messages.payload — kernel ConversationMessage 去掉 pos（pos 由列维护） */
export const messagePayloadSchema = conversationPayloadSchema;
export type MessagePayload = ConversationPayload;
