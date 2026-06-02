import { compress, deriveBoundariesFromL4, getL4, isInToolLoop, shouldAdvance, slimMessage, SUMMARY_SYNTHETIC_POS, buildRuntimeFromLPoints } from "@freeanima/legacy-engine";
import { parseCompressionState } from "@freeanima/legacy-kernel";
import { describe, it, expect } from "bun:test";


function ua(pos: number, text = "u"): Record<string, unknown> {
  return { role: "user", content: text, pos };
}

function aa(pos: number, text = "a"): Record<string, unknown> {
  return { role: "assistant", content: text, pos };
}

function toolMsg(pos: number): Record<string, unknown> {
  return { role: "tool", tool_call_id: "c1", content: "ok", pos };
}

function buildHistory(n: number, startPos = 1): Record<string, unknown>[] {
  const msgs: Record<string, unknown>[] = [];
  let pos = startPos;
  for (let i = 0; i < n; i++) {
    msgs.push(ua(pos++, `u${i}`), aa(pos++, `a${i}`));
  }
  return msgs;
}

const smallBoundary = { rawMinMessages: 3, slimMinMessages: 4 };

describe("compression v5.1", () => {
  it("parseCompressionState migrates cut_id / last_summarized_cut_id", () => {
    const s = parseCompressionState({
      cut_id: 10,
      summary: "x",
      last_summarized_cut_id: 8,
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
    expect(slim?.tool_calls).toBeUndefined();
  });

  it("deriveBoundariesFromL4 rejects l3 when raw segment does not start with user", () => {
    const msgs = [
      ...buildHistory(20),
      ua(41, "tail-user"),
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "c1", type: "function", function: { name: "x", arguments: "{}" } }],
        pos: 42,
      },
      toolMsg(43),
    ];
    const l4 = getL4(msgs);
    const derived = deriveBoundariesFromL4(msgs, l4, null, smallBoundary);
    if (derived) {
      const rest = msgs.filter((m) => m.role !== "system" && m.role !== "session_meta");
      const rawStart = rest
        .filter((m) => typeof m.pos === "number" && m.pos > derived.l3 && m.pos <= l4)
        .sort((a, b) => Number(a.pos) - Number(b.pos))[0];
      expect(rawStart?.role).toBe("user");
    }
  });

  it("deriveBoundariesFromL4 is deterministic and independent of isInToolLoop", () => {
    const msgs = buildHistory(40);
    const l4 = getL4(msgs);
    const a = deriveBoundariesFromL4(msgs, l4, null, smallBoundary);
    const b = deriveBoundariesFromL4(msgs, l4, null, smallBoundary);
    expect(a).toEqual(b);
    const withLoop = [
      ...msgs,
      ua(81, "tail-user"),
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "c1", type: "function", function: { name: "x", arguments: "{}" } }],
        pos: 82,
      },
      toolMsg(83),
    ];
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
