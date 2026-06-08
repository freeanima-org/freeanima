import { createEventTopic } from "@freeanima/kernel-eventbus";

export type SessionUpdatedPayload = {
  session_id: string;
};

export type SemanticMemoryUpdatedPayload = {
  semantic_memory_ids?: string[];
};

export type TestPingPayload = Record<string, unknown>;

/** 与 legacy events.db topic 列兼容 */
export const sessionUpdated = createEventTopic<SessionUpdatedPayload>(
  "session:updated",
  "会话更新",
);

export const semanticMemoryUpdated = createEventTopic<SemanticMemoryUpdatedPayload>(
  "semantic_memory:updated",
  "语义记忆更新",
);

export const testPing = createEventTopic<TestPingPayload>("test:ping", "测试 ping");
