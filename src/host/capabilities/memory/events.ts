import { createHook } from "@freeanima/host/kernel/hooks";

export type ConversationUpdatedPayload = {
  conversation_id: string;
};

export type SemanticMemoryUpdatedPayload = {
  semantic_memory_ids?: number[];
};

export type TestPingPayload = Record<string, unknown>;

/** Conversation metadata changed; typically `subscribe` + `emit`/`run` (no intercept). */
export const conversationUpdated = createHook<ConversationUpdatedPayload>(
  "conversation:updated",
  "Conversation updated",
);

export const semanticMemoryUpdated = createHook<SemanticMemoryUpdatedPayload>(
  "semantic_memory:updated",
  "Semantic memory updated",
);

export const testPing = createHook<TestPingPayload>("test:ping", "Test ping");
