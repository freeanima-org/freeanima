import { compress } from "@freeanima/legacy-engine";
import { describe, it, expect } from "bun:test";


function ua(i: number): Record<string, unknown> {
  return { role: "user", content: `u${i}`, pos: i * 2 + 1 };
}

function aa(i: number): Record<string, unknown> {
  return { role: "assistant", content: `a${i}`, pos: i * 2 + 2 };
}

function toolMsg(pos: number, callId: string): Record<string, unknown> {
  return { role: "tool", tool_call_id: callId, content: "ok", pos };
}

function assistantToolCall(pos: number, callId: string): Record<string, unknown> {
  return {
    role: "assistant",
    content: null,
    tool_calls: [{ id: callId, type: "function", function: { name: "x", arguments: "{}" } }],
    pos,
  };
}

const testBoundary = { rawMinMessages: 3, slimMinMessages: 4 };

describe("compressor", () => {
  it("returns original when below threshold", () => {
    const msgs = [ua(0), aa(0), ua(1), aa(1)];
    const [out, state] = compress(msgs, { maxRounds: 50, boundaryOverrides: testBoundary });
    expect(out).toStrictEqual(msgs);
    expect(state).toBeNull();
  });

  it("triggers compression and sets l2/l3", () => {
    const msgs: Record<string, unknown>[] = [];
    for (let i = 0; i < 55; i++) {
      msgs.push(ua(i), aa(i));
    }
    const [out, state] = compress(msgs, {
      maxRounds: 50,
      force: true,
      boundaryOverrides: testBoundary,
    });
    expect(out.length).toBeLessThan(msgs.length);
    expect(state).toEqual({
      l2: expect.any(Number),
      l3: expect.any(Number),
      summary: undefined,
      summary_at: undefined,
    });
    expect(state!.l2).toBeLessThan(state!.l3);
  });

  it("keeps boundaries frozen until recompress threshold", () => {
    const msgs: Record<string, unknown>[] = [];
    for (let i = 0; i < 55; i++) {
      msgs.push(ua(i), aa(i));
    }
    const [out1, state1] = compress(msgs, {
      maxRounds: 50,
      force: true,
      boundaryOverrides: testBoundary,
    });
    expect(state1).not.toBeNull();

    const [out2, state2] = compress(msgs, {
      maxRounds: 50,
      state: state1,
      boundaryOverrides: testBoundary,
    });
    expect(out2.length).toBe(out1.length);
    expect(state2).toEqual(state1);
  });

  it("raw segment starts at user after advancing l3", () => {
    const msgs: Record<string, unknown>[] = [];
    for (let i = 0; i < 54; i++) {
      msgs.push(ua(i), aa(i));
    }
    msgs.push(
      { role: "user", content: "u54", pos: 109 },
      assistantToolCall(110, "c1"),
      toolMsg(111, "c1"),
      { role: "user", content: "u55", pos: 112 },
      { role: "assistant", content: "a55", pos: 113 },
    );
    const [out, state] = compress(msgs, {
      maxRounds: 50,
      force: true,
      state: { l2: 2, l3: 100 },
      boundaryOverrides: testBoundary,
    });
    const rest = out.filter((m) => m.role !== "system");
    const raw = rest.filter((m) => Number(m.pos) > (state?.l3 ?? 0));
    expect(raw[0]?.role).toBe("user");
    expect(state!.l3).toBeGreaterThan(100);
  });
});
