import { describe, expect, it } from "bun:test";
import { resolveSummarizeCut } from "./summarize-collapse.ts";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";

function msg(
  role: StoredMessage["role"],
  pos: number,
  extra?: Partial<StoredMessage>,
): StoredMessage {
  return { role, content: "x", pos, ...extra } as StoredMessage;
}

describe("resolveSummarizeCut", () => {
  it("returns empty when no messages", () => {
    expect(resolveSummarizeCut([])).toEqual({ ok: false, error: "empty" });
  });

  it("idle: last assistant → cut = l4", () => {
    const msgs = [msg("user", 2), msg("assistant", 3), msg("user", 4), msg("assistant", 5)];
    expect(resolveSummarizeCut(msgs)).toEqual({ ok: true, cut: 5, idle: true, l4: 5 });
  });

  it("in progress: trailing user → cut at last completed assistant", () => {
    const msgs = [msg("user", 2), msg("assistant", 3), msg("user", 4)];
    expect(resolveSummarizeCut(msgs)).toEqual({ ok: true, cut: 3, idle: false, l4: 4 });
  });

  it("active tool loop with no completed assistant → in_progress", () => {
    const msgs = [
      msg("user", 2),
      msg("assistant", 3, {
        tool_calls: [{ id: "t1", type: "function", function: { name: "x", arguments: "{}" } }],
      }),
      msg("tool", 4, { tool_call_id: "t1", content: "{}" }),
    ];
    expect(resolveSummarizeCut(msgs)).toEqual({ ok: false, error: "in_progress" });
  });

  it("skips assistant with tool_calls when finding last completed assistant", () => {
    const msgs = [
      msg("user", 2),
      msg("assistant", 3),
      msg("user", 4),
      msg("assistant", 5, {
        tool_calls: [{ id: "t1", type: "function", function: { name: "x", arguments: "{}" } }],
      }),
    ];
    expect(resolveSummarizeCut(msgs)).toEqual({ ok: true, cut: 3, idle: false, l4: 5 });
  });
});
