import { createEventTopic } from "@freeanima/kernel/eventbus";

export type SessionUpdatedPayload = {
  session_id: string;
};

export type SemanticMemoryUpdatedPayload = {
  semantic_memory_ids?: string[];
};

export type TestPingPayload = Record<string, unknown>;

/** Compatible with legacy events.db topic column */
export const sessionUpdated = createEventTopic<SessionUpdatedPayload>(
  "session:updated",
  "Session updated",
);

export const semanticMemoryUpdated = createEventTopic<SemanticMemoryUpdatedPayload>(
  "semantic_memory:updated",
  "Semantic memory updated",
);

export const testPing = createEventTopic<TestPingPayload>("test:ping", "Test ping");
