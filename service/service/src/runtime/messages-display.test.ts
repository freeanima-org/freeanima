import { buildMessagesDisplay, paginateMessagesDisplay } from "./build-messages-display.ts";
import { describe, expect, it } from "bun:test";

import type { SessionMessage } from "@freeanima/engine-db/domain";

describe("buildMessagesDisplay", () => {
  it("aggregates assistant tool_calls and tool results into tool_block", () => {
    const msgs: SessionMessage[] = [
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
    const msgs: SessionMessage[] = Array.from({ length: 5 }, (_, i) => ({
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
    const msgs: SessionMessage[] = [{ role: "user", content: "a" }];
    const all = paginateMessagesDisplay("sess", msgs);
    expect(all.limit).toBeNull();
    expect(all.display).toHaveLength(1);
  });
});
