import { describe, expect, test } from "bun:test";

import { displayItemsToChatMessages } from "./chat-history.ts";

describe("displayItemsToChatMessages", () => {
  test("message + tool_block", () => {
    const msgs = displayItemsToChatMessages([
      { type: "message", role: "user", content: "hi" },
      {
        type: "tool_block",
        calls: [{ name: "file_read", argsPreview: "a.ts", tool_call_id: "1", status: "ok" }],
      },
      { type: "message", role: "assistant", content: "done" },
    ]);
    expect(msgs.map((m) => m.role)).toEqual(["user", "tool", "assistant"]);
    expect(msgs[0]!.content).toBe("hi");
    expect(msgs[1]!.content).toContain("file_read");
    expect(msgs[2]!.content).toBe("done");
  });
});
