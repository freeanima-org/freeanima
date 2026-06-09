import {
  compress,
  deriveBoundariesFromL4,
  getL4,
  isInToolLoop,
  shouldAdvance,
  slimMessage,
  SUMMARY_SYNTHETIC_POS,
  buildRuntimeFromLPoints,
} from "@freeanima/engine-compress";
import { isAssistantMessage, parseCompressionState } from "@freeanima/engine-db/domain";
import { afterEach, beforeEach, describe, it, expect } from "bun:test";
import { aa, assistantToolCall, buildHistory, toolMsg, ua } from "../helpers/session-fixtures.ts";
import {
  beginMinimalConfigHome,
  endMinimalConfigHome,
} from "../../../../tests/helpers/minimal-config-home.ts";

const smallBoundary = { rawMinMessages: 3, slimMinMessages: 4 };

let prevHome: string | undefined;

beforeEach(() => {
  ({ prevHome } = beginMinimalConfigHome("anima-compress-"));
});

afterEach(() => {
  endMinimalConfigHome(prevHome);
});

describe("compression v5.1", () => {
  it("parseCompressionState 解析 l2/l3", () => {
    const s = parseCompressionState({
      l2: 8,
      l3: 10,
      summary: "x",
    });
    expect(s).toEqual({ l2: 8, l3: 10, summary: "x" });
  });

  it("slimMessage drops tool and strips assistant tool_calls", () => {
    expect(slimMessage(toolMsg(1))).toBeNull();
    const slim = slimMessage({
      role: "assistant",
      content: null,
      reasoning: "think",
      tool_calls: [{ id: "1", type: "function", function: { name: "x", arguments: "{}" } }],
      pos: 2,
    });
    expect(slim?.content).toBe("think");
    expect(isAssistantMessage(slim!)).toBe(true);
    if (slim && isAssistantMessage(slim)) {
      expect(slim.tool_calls).toBeUndefined();
    }
  });

  it("slimMessage 为仅 tool_calls 的 assistant 生成占位正文", () => {
    const slim = slimMessage({
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "1", type: "function", function: { name: "read_file", arguments: "{}" } },
        { id: "2", type: "function", function: { name: "grep", arguments: "{}" } },
      ],
      pos: 2,
    });
    expect(slim?.content).toBe("[已执行工具: read_file, grep]");
  });

  it("slimMessage 丢弃完全空白的 assistant", () => {
    expect(slimMessage({ role: "assistant", content: null, pos: 2 })).toBeNull();
  });

  it("deriveBoundariesFromL4 rejects l3 when raw segment does not start with user", () => {
    const msgs = [
      ...buildHistory(20),
      ua(41, "tail-user"),
      assistantToolCall(42, "c1"),
      toolMsg(43),
    ];
    const l4 = getL4(msgs);
    const derived = deriveBoundariesFromL4(msgs, l4, null, smallBoundary);
    if (derived) {
      const rest = msgs.filter((m) => m.role !== "system" && m.role !== "session_meta");
      const rawStart = rest
        .filter((m) => typeof m.pos === "number" && m.pos > derived.l3 && m.pos <= l4)
        .toSorted((a, b) => Number(a.pos) - Number(b.pos))[0];
      expect(rawStart?.role).toBe("user");
    }
  });

  it("deriveBoundariesFromL4 is deterministic and independent of isInToolLoop", () => {
    const msgs = buildHistory(40);
    const l4 = getL4(msgs);
    const a = deriveBoundariesFromL4(msgs, l4, null, smallBoundary);
    const b = deriveBoundariesFromL4(msgs, l4, null, smallBoundary);
    expect(a).toEqual(b);
    const withLoop = [...msgs, ua(81, "tail-user"), assistantToolCall(82, "c1"), toolMsg(83)];
    expect(isInToolLoop(withLoop)).toBe(true);
    expect(isInToolLoop(msgs)).toBe(false);
  });

  it("shouldAdvance uses different thresholds inside tool loop", () => {
    const low = 0.6;
    const high = 0.8;
    const emerg = 0.92;
    expect(
      shouldAdvance({
        usageRatio: 0.65,
        inToolLoop: false,
        hasCompressed: true,
        triggerLow: low,
        triggerHigh: high,
        emergencyRatio: emerg,
      }).advance,
    ).toBe(true);
    expect(
      shouldAdvance({
        usageRatio: 0.65,
        inToolLoop: true,
        hasCompressed: true,
        triggerLow: low,
        triggerHigh: high,
        emergencyRatio: emerg,
      }).advance,
    ).toBe(false);
    expect(
      shouldAdvance({
        usageRatio: 0.85,
        inToolLoop: true,
        hasCompressed: true,
        triggerLow: low,
        triggerHigh: high,
        emergencyRatio: emerg,
      }).advance,
    ).toBe(true);
  });

  it("buildRuntimeFromLPoints injects summary at id=1", () => {
    const msgs = buildHistory(10);
    const view = buildRuntimeFromLPoints(msgs, {
      l2: 4,
      l3: 14,
      summary: "此前聊过压缩",
    });
    expect(view[0]?.pos).toBe(SUMMARY_SYNTHETIC_POS);
    expect(String(view[0]?.content)).toContain("此前聊过压缩");
  });

  it("compress advances l2/l3 monotonically", () => {
    const msgs = buildHistory(60);
    const [out1, s1] = compress(msgs, {
      maxRounds: 50,
      force: true,
      boundaryOverrides: smallBoundary,
    });
    expect(s1).not.toBeNull();
    expect(out1.length).toBeLessThan(msgs.length);
    const extended = [...msgs, ua(200, "new"), aa(201)];
    const [out2, s2] = compress(extended, {
      maxRounds: 50,
      force: true,
      state: s1,
      boundaryOverrides: smallBoundary,
    });
    expect(s2!.l2).toBeGreaterThanOrEqual(s1!.l2);
    expect(s2!.l3).toBeGreaterThanOrEqual(s1!.l3);
    expect(out2.some((m) => m.content === "new")).toBe(true);
  });
});
