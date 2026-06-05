import type { StreamEvent } from "@freeanima/engine-loop";

import type { Message, TextBasedChannel } from "discord.js";
import { describe, expect, it, vi, beforeEach, afterEach } from "bun:test";
import { streamReplyToChannel } from "@freeanima/connectors-gateway";
import { beginLogIsolation, endLogIsolation } from "../../../../tests/helpers/log-isolation.ts";

const prevHome = process.env.FREEANIMA_HOME;
beforeEach(() => {
  beginLogIsolation("freeanima-discord-stream-");
});
afterEach(() => {
  endLogIsolation(prevHome);
});

describe("streamReplyToChannel", () => {
  function fakeChannel(): {
    channel: TextBasedChannel;
    edits: string[];
    sends: string[];
    sentMessages: Array<Pick<Message, "edit">>;
  } {
    const edits: string[] = [];
    const sends: string[] = [];
    const sentMessages: Array<Pick<Message, "edit">> = [];

    const channel = {
      send: vi.fn(async (arg: unknown) => {
        const text = typeof arg === "string" ? arg : "";
        sends.push(text);
        const sentMsg = {
          edit: vi.fn(async (opts: { content: string }) => {
            edits.push(opts.content);
          }),
        } as unknown as Pick<Message, "edit">;
        sentMessages.push(sentMsg);
        return sentMsg as Message;
      }),
    };
    return {
      channel: channel as unknown as TextBasedChannel,
      edits,
      sends,
      sentMessages,
    };
  }

  it("tool 轮单独 send，含参数与结果摘要", async () => {
    const { channel, sends, edits } = fakeChannel();
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "tool_begin", data: { name: "demo_tool", args: { q: "test" } } };
      yield {
        event: "tool_result",
        data: { name: "demo_tool", content: "SECRET_SHOULD_APPEAR_TRUNCATED" },
      };
      yield { event: "token", data: { content: "final z" } };
      yield { event: "done", data: {} };
    }
    await streamReplyToChannel(channel, gen());

    expect(sends[0]).toContain("🔧 demo_tool");
    expect(sends[0]).toContain("test");
    expect(sends[0]).toContain("SECRET");
    expect(sends[1]).toContain("思考中");
    const lastEdit = edits[edits.length - 1];
    expect(lastEdit).toBe("final z");
    expect(lastEdit).not.toContain("思考中");
  });

  it("两轮 tool + 最终答案分多条消息", async () => {
    const { channel, sends } = fakeChannel();
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "tool_begin", data: { name: "read", args: {} } };
      yield { event: "tool_result", data: { name: "read", content: "ok" } };
      yield { event: "token", data: { content: "x" } };
      yield { event: "tool_begin", data: { name: "grep", args: { p: "a" } } };
      yield { event: "tool_result", data: { name: "grep", content: "hit" } };
      yield { event: "token", data: { content: "answer" } };
      yield { event: "done", data: {} };
    }
    await streamReplyToChannel(channel, gen());

    expect(sends.length).toBeGreaterThanOrEqual(3);
    expect(sends[0]).toContain("read");
    expect(sends[1]).toContain("思考中");
    expect(sends[2]).toContain("grep");
  });

  it("超长正文按 1000 字阈值拆条", async () => {
    const { channel, edits, sends } = fakeChannel();
    const body = "a".repeat(1500);
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "token", data: { content: body } };
      yield { event: "done", data: {} };
    }
    await streamReplyToChannel(channel, gen());
    expect(edits.length).toBeGreaterThan(0);
    expect(edits[edits.length - 1]!.length).toBe(1000);
    expect(sends.length).toBeGreaterThanOrEqual(2);
  });

  it("最终 edit 失败时 fallback 新发正文", async () => {
    const edits: string[] = [];
    const sends: string[] = [];
    const sentMsg = {
      edit: vi.fn(async (opts: { content: string }) => {
        edits.push(opts.content);
        if (!opts.content.includes("思考中")) throw { status: 403 };
      }),
    } as unknown as Pick<Message, "edit">;

    const channel = {
      send: vi.fn(async (arg: unknown) => {
        const text = typeof arg === "string" ? arg : "";
        sends.push(text);
        return sentMsg as Message;
      }),
    };

    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "token", data: { content: "hello discord" } };
      yield { event: "done", data: {} };
    }
    await streamReplyToChannel(channel as unknown as TextBasedChannel, gen());
    expect(sends.some((s) => s === "hello discord")).toBe(true);
  });

  it("done 事件立即收尾", async () => {
    const { channel, edits, sends } = fakeChannel();
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "token", data: { content: "final answer" } };
      yield { event: "done", data: {} };
    }
    await streamReplyToChannel(channel, gen());
    expect(sends[0]).toContain("思考中");
    const lastEdit = edits[edits.length - 1];
    expect(lastEdit).toBe("final answer");
  });

  it("done 后 generator 仍挂起时不阻塞 finalize", async () => {
    const { channel, edits } = fakeChannel();
    let hangResolve: () => void = () => {};
    const hangGate = new Promise<void>((resolve) => {
      hangResolve = resolve;
    });

    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "token", data: { content: "quick" } };
      yield { event: "done", data: {} };
      await hangGate;
    }

    const done = streamReplyToChannel(channel, gen());
    await Promise.race([
      done,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 500)),
    ]);
    expect(edits[edits.length - 1]).toBe("quick");
    hangResolve();
  });
});
