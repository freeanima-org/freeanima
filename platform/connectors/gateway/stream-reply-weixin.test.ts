import type { StreamEvent } from "@freeanima/runtime/loop";
import { describe, expect, it } from "bun:test";

import { streamReplyToWeixin } from "@freeanima/platform/connectors/gateway";

async function* events(items: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const ev of items) yield ev;
}

describe("streamReplyToWeixin", () => {
  it("one tool round merged into one message, body sent separately", async () => {
    const sent: string[] = [];
    const result = await streamReplyToWeixin(
      events([
        { event: "tool_begin", data: { name: "grep", args: { pattern: "foo" } } },
        { event: "tool_result", data: { name: "grep", content: "matched" } },
        { event: "tool_round_end", data: { tool_count: 1 } },
        { event: "token", data: { content: "WeChat channel OK." } },
        { event: "done", data: {} },
      ]),
      {
        send: async (text) => {
          sent.push(text);
        },
      },
      { toolDisplayMode: "name_args_truncated" },
    );

    expect(result.progressSent).toBe(true);
    expect(result.answerSent).toBe(true);
    expect(sent.length).toBe(2);
    expect(sent[0]).toContain("🔧 grep");
    expect(sent[0]).toContain("foo");
    expect(sent[0]).toContain("matched");
    expect(sent[1]).toBe("WeChat channel OK.");
  });

  it("default name mode shows tool names only", async () => {
    const sent: string[] = [];
    await streamReplyToWeixin(
      events([
        { event: "tool_begin", data: { name: "grep", args: { pattern: "foo" } } },
        { event: "tool_result", data: { name: "grep", content: "matched" } },
        { event: "tool_round_end", data: { tool_count: 1 } },
        { event: "token", data: { content: "OK" } },
        { event: "done", data: {} },
      ]),
      {
        send: async (text) => {
          sent.push(text);
        },
      },
    );
    expect(sent[0]).toBe("🔧 grep");
  });

  it("two tool rounds each one message", async () => {
    const sent: string[] = [];
    await streamReplyToWeixin(
      events([
        { event: "tool_begin", data: { name: "read", args: {} } },
        { event: "tool_result", data: { name: "read", content: "ok" } },
        { event: "tool_round_end", data: { tool_count: 1 } },
        { event: "token", data: { content: "mid" } },
        { event: "tool_begin", data: { name: "grep", args: { q: "x" } } },
        { event: "tool_result", data: { name: "grep", content: "hit" } },
        { event: "tool_round_end", data: { tool_count: 1 } },
        { event: "token", data: { content: "done" } },
        { event: "done", data: {} },
      ]),
      {
        send: async (text) => {
          sent.push(text);
        },
      },
    );

    expect(sent.length).toBe(4);
    expect(sent[0]).toContain("read");
    expect(sent[1]).toBe("mid");
    expect(sent[2]).toContain("grep");
    expect(sent[3]).toBe("done");
  });

  it("empty stream not sent", async () => {
    const sent: string[] = [];
    const result = await streamReplyToWeixin(events([{ event: "done", data: {} }]), {
      send: async (text) => {
        sent.push(text);
      },
    });

    expect(result.progressSent).toBe(false);
    expect(result.answerSent).toBe(false);
    expect(sent).toEqual([]);
  });
});
