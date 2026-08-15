import { describe, expect, test } from "bun:test";
import { displayAwaitingReply, isStalledReply } from "./display-recovery.ts";
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
