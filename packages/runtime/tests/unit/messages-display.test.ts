import { buildMessagesDisplay, paginateMessagesDisplay } from "@freeanima/legacy-runtime";
import { describe, expect, it } from "bun:test";

import type { SessionMessage } from "@freeanima/legacy-kernel";

describe("buildMessagesDisplay", () => {
  it("聚合 assistant tool_calls 与 tool 结果为 tool_block", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "查一下天气" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "web_search", arguments: '{"query":"北京天气"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: '{"temp": 25}' },
      { role: "assistant", content: "北京今天 25 度" },
    ];

    const display = buildMessagesDisplay(msgs);
    expect(display).toHaveLength(3);
    expect(display[0]).toEqual({ type: "message", role: "user", content: "查一下天气" });
    expect(display[1].type).toBe("tool_block");
    if (display[1].type === "tool_block") {
      expect(display[1].calls).toHaveLength(1);
      expect(display[1].calls[0].name).toBe("web_search");
      expect(display[1].calls[0].args).toEqual({ query: "北京天气" });
      expect(display[1].calls[0].result).toBe('{"temp": 25}');
      expect(display[1].calls[0].status).toBe("done");
    }
    expect(display[2]).toEqual({
      type: "message",
      role: "assistant",
      content: "北京今天 25 度",
    });
  });

  it("分页返回 total/offset/limit", () => {
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

  it("无 limit 时返回全部", () => {
    const msgs: SessionMessage[] = [{ role: "user", content: "a" }];
    const all = paginateMessagesDisplay("sess", msgs);
    expect(all.limit).toBeNull();
    expect(all.display).toHaveLength(1);
  });
});
