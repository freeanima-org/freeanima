import { describe, expect, it } from "bun:test";
import { stripCachedToolsetLoadRounds } from "./toolset-load-view.ts";
import type { SessionMessage } from "@freeanima/core/db/domain";

describe("stripCachedToolsetLoadRounds", () => {
  it("strips load round when toolset is cached", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "c1",
            type: "function",
            function: { name: "toolsets_load", arguments: '{"toolsets":["file"]}' },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "c1",
        name: "toolsets_load",
        content: '{"loaded":["file"]}',
      },
      { role: "assistant", content: "done" },
    ];
    const out = stripCachedToolsetLoadRounds(msgs, ["file"]);
    expect(out.some((m) => m.role === "tool")).toBe(false);
    expect(out.filter((m) => m.role === "assistant")).toHaveLength(1);
  });

  it("keeps load round when toolset is not cached", () => {
    const msgs: SessionMessage[] = [
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "c1",
            type: "function",
            function: { name: "toolsets_load", arguments: '{"toolsets":["file"]}' },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "c1",
        name: "toolsets_load",
        content: '{"loaded":["file"]}',
      },
    ];
    const out = stripCachedToolsetLoadRounds(msgs, []);
    expect(out).toHaveLength(2);
  });
});
