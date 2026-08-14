import { createHook } from "@freeanima/habitat/kernel/hooks";

export type ConversationUpdatedPayload = {
  conversation_id: string;
};

/** Conversation metadata changed; typically `subscribe` + `emit`/`run` (no intercept). */
export const conversationUpdated = createHook<ConversationUpdatedPayload>(
  "conversation:updated",
  "Conversation updated",
);
