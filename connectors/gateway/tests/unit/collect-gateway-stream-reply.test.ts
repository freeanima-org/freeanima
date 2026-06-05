import type { StreamEvent } from "@freeanima/engine-loop";
import { describe, expect, it } from "bun:test";

import { collectGatewayStreamReply } from "@freeanima/connectors-gateway";

async function* events(items: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const ev of items) yield ev;
}

describe("collectGatewayStreamReply", () => {
  it("token 事件拼接为最终回复", async () => {
    const reply = await collectGatewayStreamReply(
      events([
        { event: "token", data: { content: "你好" } },
        { event: "done", data: {} },
      ]),
      "weixin",
    );
    expect(reply).toBe("你好");
  });

  it("content_replace 覆盖先前 token", async () => {
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

  it("仅 done 时返回空串", async () => {
    const reply = await collectGatewayStreamReply(events([{ event: "done", data: {} }]), "weixin");
    expect(reply).toBe("");
  });
});
