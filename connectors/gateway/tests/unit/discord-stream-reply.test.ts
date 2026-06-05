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

type TimelineEntry = { kind: "send" | "edit"; text: string };

describe("streamReplyToChannel", () => {
  function fakeChannel(): {
    channel: TextBasedChannel;
    edits: string[];
    sends: string[];
    sentMessages: Array<Pick<Message, "edit">>;
    timeline: TimelineEntry[];
  } {
    const edits: string[] = [];
    const sends: string[] = [];
    const sentMessages: Array<Pick<Message, "edit">> = [];
    const timeline: TimelineEntry[] = [];

    const channel = {
      send: vi.fn(async (arg: unknown) => {
        const text = typeof arg === "string" ? arg : "";
        sends.push(text);
        timeline.push({ kind: "send", text });
        const sentMsg = {
          edit: vi.fn(async (opts: { content: string }) => {
            edits.push(opts.content);
            timeline.push({ kind: "edit", text: opts.content });
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
      timeline,
    };
  }

  function timelineIndex(timeline: TimelineEntry[], pred: (e: TimelineEntry) => boolean): number {
    return timeline.findIndex(pred);
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
    const { channel, sends, timeline } = fakeChannel();
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
    expect(sends.some((s) => s.includes("grep"))).toBe(true);

    const grepSendIdx = timelineIndex(
      timeline,
      (e) => e.kind === "send" && e.text.includes("grep"),
    );
    const answerEditIdx = timelineIndex(timeline, (e) => e.kind === "edit" && e.text === "answer");
    const part1CommitIdx = timelineIndex(timeline, (e) => e.kind === "edit" && e.text === "x");
    expect(part1CommitIdx).toBeGreaterThanOrEqual(0);
    expect(grepSendIdx).toBeGreaterThan(part1CommitIdx);
    expect(answerEditIdx).toBeGreaterThan(grepSendIdx);
  });

  it("答案中途插入 tool 时 tool 在已固化片段之后、续答之前", async () => {
    const { channel, timeline } = fakeChannel();
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "token", data: { content: "part1" } };
      yield { event: "tool_begin", data: { name: "search", args: { q: "x" } } };
      yield { event: "tool_result", data: { name: "search", content: "hit" } };
      yield { event: "token", data: { content: "part2" } };
      yield { event: "done", data: {} };
    }
    await streamReplyToChannel(channel, gen());

    const part1CommitIdx = timelineIndex(timeline, (e) => e.kind === "edit" && e.text === "part1");
    const toolSendIdx = timelineIndex(
      timeline,
      (e) => e.kind === "send" && e.text.includes("search"),
    );
    const part2EditIdx = timelineIndex(timeline, (e) => e.kind === "edit" && e.text === "part2");
    expect(part1CommitIdx).toBeGreaterThanOrEqual(0);
    expect(toolSendIdx).toBeGreaterThan(part1CommitIdx);
    expect(part2EditIdx).toBeGreaterThan(toolSendIdx);
  });

  it("长答案拆段时 tool 不插在段落中间", async () => {
    const { channel, timeline } = fakeChannel();
    const head = "a".repeat(1500);
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "token", data: { content: head } };
      yield { event: "tool_begin", data: { name: "lookup", args: {} } };
      yield { event: "tool_result", data: { name: "lookup", content: "ok" } };
      yield { event: "token", data: { content: "tail" } };
      yield { event: "done", data: {} };
    }
    await streamReplyToChannel(channel, gen());

    const toolSendIdx = timelineIndex(
      timeline,
      (e) => e.kind === "send" && e.text.includes("lookup"),
    );
    const tailEditIdx = timelineIndex(timeline, (e) => e.kind === "edit" && e.text === "tail");
    const extraChunkSendIdx = timelineIndex(
      timeline,
      (e) => e.kind === "send" && e.text.length === 500 && e.text.startsWith("a"),
    );
    expect(toolSendIdx).toBeGreaterThanOrEqual(0);
    expect(tailEditIdx).toBeGreaterThan(toolSendIdx);
    if (extraChunkSendIdx >= 0) {
      expect(extraChunkSendIdx).toBeGreaterThan(tailEditIdx);
    }
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
