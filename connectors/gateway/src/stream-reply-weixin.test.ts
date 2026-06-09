import type { StreamEvent } from "@freeanima/engine-loop";
import { describe, expect, it } from "bun:test";

import { streamReplyToWeixin } from "@freeanima/connectors-gateway";

async function* events(items: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const ev of items) yield ev;
}

describe("streamReplyToWeixin", () => {
  it("一轮 tool 合并为一条，正文单独发送", async () => {
    const sent: string[] = [];
    const result = await streamReplyToWeixin(
      events([
        { event: "tool_begin", data: { name: "grep", args: { pattern: "foo" } } },
        { event: "tool_result", data: { name: "grep", content: "matched" } },
        { event: "token", data: { content: "微信通道正常。" } },
        { event: "done", data: {} },
      ]),
      {
        send: async (text) => {
          sent.push(text);
        },
      },
    );

    expect(result.progressSent).toBe(true);
    expect(result.answerSent).toBe(true);
    expect(sent.length).toBe(2);
    expect(sent[0]).toContain("🔧 grep");
    expect(sent[0]).toContain("foo");
    expect(sent[0]).toContain("matched");
    expect(sent[1]).toBe("微信通道正常。");
  });

  it("两轮 tool 各一条消息", async () => {
    const sent: string[] = [];
    await streamReplyToWeixin(
      events([
        { event: "tool_begin", data: { name: "read", args: {} } },
        { event: "tool_result", data: { name: "read", content: "ok" } },
        { event: "token", data: { content: "mid" } },
        { event: "tool_begin", data: { name: "grep", args: { q: "x" } } },
        { event: "tool_result", data: { name: "grep", content: "hit" } },
        { event: "token", data: { content: "done" } },
        { event: "done", data: {} },
      ]),
      {
        send: async (text) => {
          sent.push(text);
        },
      },
    );

    expect(sent.length).toBe(3);
    expect(sent[0]).toContain("read");
    expect(sent[1]).toContain("grep");
    expect(sent[2]).toBe("done");
  });

  it("空流不发送", async () => {
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
