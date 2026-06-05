import { createEventTopic } from "@freeanima/kernel-eventbus";

export type SessionUpdatedPayload = {
  session_id: string;
};

export type L2UpdatedPayload = {
  session_id: string;
};

export type L3UpdatedPayload = {
  fact_ids?: string[];
};

export type TestPingPayload = Record<string, unknown>;

/** 与 legacy events.db topic 列兼容 */
export const sessionUpdated = createEventTopic<SessionUpdatedPayload>(
  "session:updated",
  "会话 L1 更新",
);

export const l2Updated = createEventTopic<L2UpdatedPayload>("l2:updated", "L2 蒸馏完成");

export const l3Updated = createEventTopic<L3UpdatedPayload>("l3:updated", "L3 事实更新");

export const testPing = createEventTopic<TestPingPayload>("test:ping", "测试 ping");
