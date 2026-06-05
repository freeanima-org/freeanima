import { compress, SUMMARY_USER_PREFIX } from "@freeanima/engine-compress";
import { parseCompressionState, type SessionMessage } from "@freeanima/kernel-schemas";
import { afterEach, beforeEach, describe, it, expect } from "bun:test";
import { aa, ua } from "../helpers/session-fixtures.ts";
import {
  beginMinimalConfigHome,
  endMinimalConfigHome,
} from "../../../../tests/helpers/minimal-config-home.ts";

const testBoundary = { rawMinMessages: 2, slimMinMessages: 2 };

let prevHome: string | undefined;

beforeEach(() => {
  ({ prevHome } = beginMinimalConfigHome("anima-compress-"));
});

afterEach(() => {
  endMinimalConfigHome(prevHome);
});

describe("compression extended", () => {
  it("parseCompressionState reads l2/l3 summary", () => {
    const s = parseCompressionState({
      l2: 8,
      l3: 10,
      summary: "之前讨论了压缩",
      summary_at: "2026-05-28T00:00:00+08:00",
    });
    expect(s?.l2).toBe(8);
    expect(s?.l3).toBe(10);
    expect(s?.summary).toContain("压缩");
  });

  it("token mode triggers on estimated tokens", () => {
    const big = "x".repeat(400_000);
    const msgs: SessionMessage[] = [
      ...Array.from({ length: 12 }, (_, i) => [ua(i * 2 + 1, "u"), aa(i * 2 + 2)]).flat(),
      ua(25, big),
      aa(26),
      ua(27, "last"),
    ];
    const [out, state] = compress(msgs, {
      maxRounds: 50,
      model: "test",
      systemPrompt: "system",
      tools: [],
      effectiveBudgetOverride: 2000,
      force: true,
      boundaryOverrides: testBoundary,
    });
    expect(state).not.toBeNull();
    expect(out.length).toBeLessThan(msgs.length);
    expect(out.some((m) => m.content === "last")).toBe(true);
  });

  it("SUMMARY_USER_PREFIX is stable for injection", () => {
    expect(SUMMARY_USER_PREFIX).toBe("[会话摘要]");
  });

  it("token mode does not re-compress when runtime view is below trigger after compress", () => {
    const history = "h".repeat(300_000);
    const msgs: SessionMessage[] = [
      ua(1, history),
      aa(2),
      ua(3, "old turn"),
      aa(4),
      ua(5, "last"),
      aa(6),
    ];
    const budget = 2000;
    const [, state1] = compress(msgs, {
      maxRounds: 50,
      model: "test",
      systemPrompt: "sys",
      tools: [],
      effectiveBudgetOverride: budget,
      force: true,
      boundaryOverrides: testBoundary,
    });
    expect(state1).not.toBeNull();
    const l3First = state1!.l3;

    const extended = [...msgs, ua(7, "one"), aa(8), ua(9, "two"), aa(10)];
    const [out2, state2] = compress(extended, {
      maxRounds: 50,
      model: "test",
      systemPrompt: "sys",
      tools: [],
      effectiveBudgetOverride: budget,
      state: state1,
      boundaryOverrides: testBoundary,
    });
    expect(state2?.l3).toBe(l3First);
    const visible2 = out2.filter((m) => m.role !== "system");
    expect(visible2.some((m) => m.content === "two")).toBe(true);
  });
});
