import { afterEach, describe, expect, it } from "bun:test";

import type { StoredMessage } from "@freeanima/host/core/db/domain";

import {
  clearToolLoopSuppression,
  isInToolLoop,
  isToolLoopSuppressionActive,
  markToolLoopActivity,
} from "./compression-tool-loop.ts";

function msg(role: StoredMessage["role"], extra: Partial<StoredMessage> = {}): StoredMessage {
  return { role, content: "", ...extra } as StoredMessage;
}

describe("isInToolLoop", () => {
  it("false when no user message", () => {
    expect(
      isInToolLoop([
        msg("assistant", {
          tool_calls: [{ id: "1", type: "function", function: { name: "x", arguments: "{}" } }],
        }),
      ]),
    ).toBe(false);
  });

  it("false when user is last message", () => {
    expect(isInToolLoop([msg("user", { content: "hi" })])).toBe(false);
  });

  it("true when tail is tool after user", () => {
    const messages = [
      msg("user", { content: "go" }),
      msg("assistant", {
        tool_calls: [{ id: "c1", type: "function", function: { name: "x", arguments: "{}" } }],
      }),
      msg("tool", { content: "result", tool_call_id: "c1" }),
    ];
    expect(isInToolLoop(messages)).toBe(true);
  });

  it("true when tail assistant still has tool_calls", () => {
    const messages = [
      msg("user", { content: "go" }),
      msg("assistant", {
        tool_calls: [{ id: "c1", type: "function", function: { name: "x", arguments: "{}" } }],
      }),
    ];
    expect(isInToolLoop(messages)).toBe(true);
  });

  it("false when assistant tail has no tool_calls", () => {
    const messages = [msg("user", { content: "go" }), msg("assistant", { content: "done" })];
    expect(isInToolLoop(messages)).toBe(false);
  });

  it("ignores system when finding last user", () => {
    const messages = [
      msg("system", { content: "sys" }),
      msg("user", { content: "go" }),
      msg("assistant", { content: "ok" }),
    ];
    expect(isInToolLoop(messages)).toBe(false);
  });
});

describe("tool loop suppression map", () => {
  const id = "conv-suppress-test";

  afterEach(() => {
    clearToolLoopSuppression(id);
  });

  it("inactive until marked", () => {
    expect(isToolLoopSuppressionActive(id, 60)).toBe(false);
  });

  it("active within timeout after mark", () => {
    markToolLoopActivity(id);
    expect(isToolLoopSuppressionActive(id, 60)).toBe(true);
  });

  it("cleared by clearToolLoopSuppression", () => {
    markToolLoopActivity(id);
    clearToolLoopSuppression(id);
    expect(isToolLoopSuppressionActive(id, 60)).toBe(false);
  });
});
