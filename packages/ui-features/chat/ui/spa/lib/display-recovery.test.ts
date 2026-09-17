import { describe, expect, test } from "bun:test";
import {
  displayAwaitingReply,
  isStalledReply,
  resolveStalledAfterLookup,
  shouldShowAwaitingPlaceholder,
} from "./display-recovery.ts";
import type { DisplayItem } from "./types.ts";

const user = (content: string): DisplayItem => ({ type: "message", role: "user", content });
const assistant = (content: string): DisplayItem => ({
  type: "message",
  role: "assistant",
  content,
});
const toolBlock = (): DisplayItem => ({
  type: "tool_block",
  calls: [{ name: "t", argsPreview: "{}", tool_call_id: "1", status: "done" }],
});

describe("displayAwaitingReply", () => {
  test("末条 user 无 assistant → true", () => {
    expect(displayAwaitingReply([user("hi")])).toBe(true);
  });

  test("user 后有 tool_block 仍 awaiting", () => {
    expect(displayAwaitingReply([user("hi"), toolBlock()])).toBe(true);
  });

  test("有 assistant content → false", () => {
    expect(displayAwaitingReply([user("hi"), assistant("ok")])).toBe(false);
  });
});

describe("shouldShowAwaitingPlaceholder", () => {
  const base = {
    currentId: "a",
    stalledReply: false,
    streamVisible: false,
    recovering: false,
    recoveringConversationId: null as string | null,
    messagesLoading: false,
    displayAwaiting: false,
    habitatConnected: true,
    userStopped: false,
  };

  test("本会话 recovering 才占位", () => {
    expect(
      shouldShowAwaitingPlaceholder({
        ...base,
        recovering: true,
        recoveringConversationId: "a",
      }),
    ).toBe(true);
    expect(
      shouldShowAwaitingPlaceholder({
        ...base,
        recovering: true,
        recoveringConversationId: "b",
      }),
    ).toBe(false);
  });

  test("用户停止或 stalled 不占位", () => {
    expect(
      shouldShowAwaitingPlaceholder({ ...base, userStopped: true, displayAwaiting: true }),
    ).toBe(false);
    expect(
      shouldShowAwaitingPlaceholder({ ...base, stalledReply: true, streamVisible: true }),
    ).toBe(false);
  });

  test("streamVisible 占位；displayAwaiting 且已连接且非 loading 占位", () => {
    expect(shouldShowAwaitingPlaceholder({ ...base, streamVisible: true })).toBe(true);
    expect(shouldShowAwaitingPlaceholder({ ...base, displayAwaiting: true })).toBe(true);
    expect(
      shouldShowAwaitingPlaceholder({ ...base, displayAwaiting: true, messagesLoading: true }),
    ).toBe(false);
    expect(
      shouldShowAwaitingPlaceholder({ ...base, displayAwaiting: true, habitatConnected: false }),
    ).toBe(false);
  });
});

describe("isStalledReply", () => {
  test("awaiting 且无 active 且非 streaming → stalled", () => {
    expect(isStalledReply({ awaitingReply: true, streaming: false, hasActiveStream: false })).toBe(
      true,
    );
  });

  test("仍有 active 流 → 不 stalled", () => {
    expect(isStalledReply({ awaitingReply: true, streaming: false, hasActiveStream: true })).toBe(
      false,
    );
  });

  test("本端 streaming → 不 stalled", () => {
    expect(isStalledReply({ awaitingReply: true, streaming: true, hasActiveStream: false })).toBe(
      false,
    );
  });

  test("已有回复 → 不 stalled", () => {
    expect(isStalledReply({ awaitingReply: false, streaming: false, hasActiveStream: false })).toBe(
      false,
    );
  });
});

describe("resolveStalledAfterLookup", () => {
  test("同步后本地仍 awaiting → stalled（真中断）", () => {
    const staleLocal = [user("hi")];
    expect(displayAwaitingReply(staleLocal)).toBe(true);
    expect(
      resolveStalledAfterLookup({
        awaitingAfterSync: displayAwaitingReply(staleLocal),
        streaming: false,
        hasActiveStream: false,
      }),
    ).toBe(true);
  });

  test("同步后已有 assistant → 不 stalled（本地曾滞后）", () => {
    const afterReload = [user("hi"), assistant("已完成")];
    expect(displayAwaitingReply(afterReload)).toBe(false);
    expect(
      resolveStalledAfterLookup({
        awaitingAfterSync: displayAwaitingReply(afterReload),
        streaming: false,
        hasActiveStream: false,
      }),
    ).toBe(false);
  });
});
