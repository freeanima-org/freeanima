import { describe, expect, it } from "bun:test";

import type { DisplayItem } from "@freeanima/features/chat/ui/spa/lib/types.ts";
import {
  mergeToolCalls,
  upsertDisplayItem,
} from "@freeanima/features/chat/ui/spa/lib/upsert-tool-block.ts";

describe("upsertDisplayItem", () => {
  it("appends non-tool items", () => {
    const display: DisplayItem[] = [{ type: "message", role: "user", content: "hi" }];
    const next = upsertDisplayItem(display, {
      type: "message",
      role: "assistant",
      content: "ok",
    });
    expect(next).toHaveLength(2);
  });

  it("merges consecutive tool_blocks by tool_call_id", () => {
    const display: DisplayItem[] = [
      {
        type: "tool_block",
        calls: [{ name: "read", argsPreview: "", tool_call_id: "stream-0", status: "running" }],
      },
    ];
    const next = upsertDisplayItem(display, {
      type: "tool_block",
      calls: [
        {
          name: "read",
          argsPreview: "",
          tool_call_id: "stream-0",
          status: "done",
          result: "ok",
        },
        { name: "grep", argsPreview: "", tool_call_id: "stream-1", status: "running" },
      ],
    });
    expect(next).toHaveLength(1);
    if (next[0]?.type === "tool_block") {
      expect(next[0].calls).toHaveLength(2);
      expect(next[0].calls[0]?.status).toBe("done");
      expect(next[0].calls[0]?.result).toBe("ok");
      expect(next[0].calls[1]?.name).toBe("grep");
    }
  });

  it("starts a new tool_block after a message", () => {
    const display: DisplayItem[] = [
      {
        type: "tool_block",
        calls: [{ name: "read", argsPreview: "", tool_call_id: "stream-0", status: "done" }],
      },
      { type: "message", role: "assistant", content: "mid" },
    ];
    const next = upsertDisplayItem(display, {
      type: "tool_block",
      calls: [{ name: "grep", argsPreview: "", tool_call_id: "stream-1", status: "running" }],
    });
    expect(next).toHaveLength(3);
    expect(next[2]?.type).toBe("tool_block");
  });
});

describe("mergeToolCalls", () => {
  it("updates existing and appends new", () => {
    const merged = mergeToolCalls(
      [{ name: "a", argsPreview: "", tool_call_id: "1", status: "running" }],
      [
        { name: "a", argsPreview: "", tool_call_id: "1", status: "done", result: "x" },
        { name: "b", argsPreview: "", tool_call_id: "2", status: "running" },
      ],
    );
    expect(merged.map((c) => `${c.tool_call_id}:${c.status}`)).toEqual(["1:done", "2:running"]);
  });
});
