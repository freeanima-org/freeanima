import { compress } from "@freeanima/engine-compress";
import type { SessionMessage } from "@freeanima/kernel-schemas";
import { afterEach, beforeEach, describe, it, expect } from "bun:test";
import { aa, assistantToolCall, toolMsg, ua } from "../helpers/session-fixtures.ts";
import {
  beginMinimalConfigHome,
  endMinimalConfigHome,
} from "../../../../tests/helpers/minimal-config-home.ts";

const testBoundary = { rawMinMessages: 3, slimMinMessages: 4 };

let prevHome: string | undefined;

beforeEach(() => {
  ({ prevHome } = beginMinimalConfigHome("anima-compress-"));
});

afterEach(() => {
  endMinimalConfigHome(prevHome);
});

describe("compressor", () => {
  it("returns original when below threshold", () => {
    const msgs = [ua(1, "u0"), aa(2, "a0"), ua(3, "u1"), aa(4, "a1")];
    const [out, state] = compress(msgs, { maxRounds: 50, boundaryOverrides: testBoundary });
    expect(out).toStrictEqual(msgs);
    expect(state).toBeNull();
  });

  it("triggers compression and sets l2/l3", () => {
    const msgs: SessionMessage[] = [];
    for (let i = 0; i < 55; i++) {
      msgs.push(ua(i * 2 + 1, `u${i}`), aa(i * 2 + 2, `a${i}`));
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
    const msgs: SessionMessage[] = [];
    for (let i = 0; i < 55; i++) {
      msgs.push(ua(i * 2 + 1, `u${i}`), aa(i * 2 + 2, `a${i}`));
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
    const msgs: SessionMessage[] = [];
    for (let i = 0; i < 54; i++) {
      msgs.push(ua(i * 2 + 1, `u${i}`), aa(i * 2 + 2, `a${i}`));
    }
    msgs.push(
      ua(109, "u54"),
      assistantToolCall(110, "c1"),
      toolMsg(111, "c1"),
      ua(112, "u55"),
      aa(113, "a55"),
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
