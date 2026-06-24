import { buildMessagesDisplay, paginateMessagesDisplay } from "./build-messages-display.ts";
import { describe, expect, it } from "bun:test";

import type { StoredMessage } from "@freeanima/core/db/domain";

describe("buildMessagesDisplay", () => {
  it("aggregates assistant tool_calls and tool results into tool_block", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "check the weather" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "web_search", arguments: '{"query":"Beijing weather"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: '{"temp": 25}' },
      { role: "assistant", content: "Beijing is 25°C today" },
    ];

    const display = buildMessagesDisplay(msgs);
    expect(display).toHaveLength(3);
    expect(display[0]).toEqual({ type: "message", role: "user", content: "check the weather" });
    expect(display[1].type).toBe("tool_block");
    if (display[1].type === "tool_block") {
      expect(display[1].calls).toHaveLength(1);
      expect(display[1].calls[0].name).toBe("web_search");
      expect(display[1].calls[0].args).toEqual({ query: "Beijing weather" });
      expect(display[1].calls[0].result).toBe('{"temp": 25}');
      expect(display[1].calls[0].status).toBe("done");
    }
    expect(display[2]).toEqual({
      type: "message",
      role: "assistant",
      content: "Beijing is 25°C today",
    });
  });

  it("paginated return with total/offset/limit", () => {
    const msgs: StoredMessage[] = Array.from({ length: 5 }, (_, i) => ({
      role: "user" as const,
      content: `msg ${i}`,
    }));
    const page = paginateMessagesDisplay("sess", msgs, { offset: 2, limit: 2 });
    expect(page.total).toBe(5);
    expect(page.offset).toBe(2);
    expect(page.limit).toBe(2);
    expect(page.display).toHaveLength(2);
    expect(page.display[0]).toMatchObject({ content: "msg 2" });
  });

  it("returns all when no limit", () => {
    const msgs: StoredMessage[] = [{ role: "user", content: "a" }];
    const all = paginateMessagesDisplay("sess", msgs);
    expect(all.limit).toBeNull();
    expect(all.display).toHaveLength(1);
  });

  it("emits separate tool_blocks for multi-round tool calls", () => {
    const msgs: StoredMessage[] = [
      { role: "user", content: "go" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "read", arguments: "{}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: "ok" },
      {
        role: "assistant",
        content: "mid",
      },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_2",
            type: "function",
            function: { name: "grep", arguments: '{"p":"a"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_2", content: "hit" },
      { role: "assistant", content: "done" },
    ];

    const display = buildMessagesDisplay(msgs);
    const toolBlocks = display.filter((d) => d.type === "tool_block");
    expect(toolBlocks).toHaveLength(2);
    if (toolBlocks[0]?.type === "tool_block") {
      expect(toolBlocks[0].calls[0]?.name).toBe("read");
    }
    if (toolBlocks[1]?.type === "tool_block") {
      expect(toolBlocks[1].calls[0]?.name).toBe("grep");
    }
    expect(display.some((d) => d.type === "message" && d.content === "mid")).toBe(true);
  });
});
