import type { StreamEvent } from "@freeanima/runtime/loop";
import { describe, expect, it } from "bun:test";

import { collectGatewayStreamReply } from "@freeanima/connectors-gateway";

async function* events(items: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const ev of items) yield ev;
}

describe("collectGatewayStreamReply", () => {
  it("token events concatenated into final reply", async () => {
    const reply = await collectGatewayStreamReply(
      events([
        { event: "token", data: { content: "Hello" } },
        { event: "done", data: {} },
      ]),
      "weixin",
    );
    expect(reply).toBe("Hello");
  });

  it("content_replace overwrites prior token", async () => {
    const reply = await collectGatewayStreamReply(
      events([
        { event: "token", data: { content: "draft" } },
        { event: "content_replace", data: { content: "final" } },
        { event: "done", data: {} },
      ]),
      "weixin",
    );
    expect(reply).toBe("final");
  });

  it("returns empty string on done only", async () => {
    const reply = await collectGatewayStreamReply(events([{ event: "done", data: {} }]), "weixin");
    expect(reply).toBe("");
  });
});
