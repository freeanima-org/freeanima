import type { StreamEvent } from "@freeanima/legacy-engine";

import type { Message, TextBasedChannel } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import { streamReplyToChannel } from "@freeanima/legacy-gateway";

describe("streamReplyToChannel", () => {
  function fakeChannel(): {
    channel: TextBasedChannel;
    edits: string[];
    sends: string[];
  } {
    const edits: string[] = [];
    const sends: string[] = [];
    const sentMsg = {
      edit: vi.fn(async (opts: { content: string }) => {
        edits.push(opts.content);
      }),
    } as Pick<Message, "edit">;

    const channel = {
      send: vi.fn(async (arg: unknown) => {
        const text = typeof arg === "string" ? arg : "";
        sends.push(text);
        return sentMsg as Message;
      }),
    };
    return { channel: channel as unknown as TextBasedChannel, edits, sends };
  }

  it("收尾去掉占位符，仅 tool_begin 行，不包含 tool_result 正文", async () => {
    const { channel, edits, sends } = fakeChannel();
    async function* gen(): AsyncGenerator<StreamEvent> {
      for (let i = 0; i < 10; i++) {
        yield { event: "token", data: { content: "x" } };
      }
      yield { event: "tool_begin", data: { name: "demo_tool", args: {} } };
      yield {
        event: "tool_result",
        data: { name: "demo_tool", content: "SECRET_SHOULD_NOT_APPEAR" },
      };
      yield { event: "token", data: { content: "z" } };
    }
    await streamReplyToChannel(channel, gen());
    expect(sends[0]).toContain("思考中");
    const lastEdit = edits[edits.length - 1];
    expect(lastEdit).not.toContain("SECRET");
    expect(lastEdit).toContain("🔧 demo_tool");
    expect(lastEdit).toContain("z");
  });

  it("超长正文收尾时首条 edit、后续 channel.send 拆条", async () => {
    const { channel, edits, sends } = fakeChannel();
    const body = "a".repeat(2500);
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "token", data: { content: body } };
    }
    await streamReplyToChannel(channel, gen());
    expect(edits.length).toBeGreaterThan(0);
    expect(edits[edits.length - 1]!.length).toBeLessThanOrEqual(2000);
    expect(sends.length).toBeGreaterThanOrEqual(2);
  });
});
