import type { StreamEvent } from "@freeanima/host/engine/loop";
import { describe, expect, it } from "bun:test";
import {
  createStreamChannelComposer,
  createWeixinBufferedAnswerStrategy,
} from "../stream-strategies/index.ts";
import { runStreamChannel } from "./run-channel.ts";

async function* events(items: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const ev of items) yield ev;
}

describe("runStreamChannel", () => {
  it("aborts on signal without further IO", async () => {
    const controller = new AbortController();
    const sent: string[] = [];
    const composer = createStreamChannelComposer({
      strategies: [createWeixinBufferedAnswerStrategy()],
      io: {
        send: async (text) => {
          sent.push(text);
        },
      },
      signal: controller.signal,
    });

    const task = runStreamChannel(
      events([
        { event: "token", data: { content: "partial" } },
        { event: "token", data: { content: " more" } },
      ]),
      composer,
      { platform: "weixin", signal: controller.signal },
    );

    controller.abort();
    await task;
    expect(sent).toEqual([]);
  });

  it("passes accepted without reducer effects", async () => {
    const accepted: StreamEvent[] = [];
    const composer = createStreamChannelComposer({
      strategies: [],
      io: {},
    });

    await runStreamChannel(
      events([
        { event: "accepted", data: {} },
        { event: "done", data: {} },
      ]),
      composer,
      {
        onRawEvent: (ev) => {
          accepted.push(ev);
        },
      },
    );

    expect(accepted.some((e) => e.event === "accepted")).toBe(true);
  });
});
