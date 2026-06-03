import { describe, expect, it } from "bun:test";
import { collectStreamReply } from "../../src/collect-stream-reply";
import type { StreamEvent } from "../../src/engine";

describe("collectStreamReply", () => {
  it("拼接 token 并在 content_replace 时替换全文", async () => {
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "token", data: { content: "hello" } };
      yield { event: "content_replace", data: { content: "final" } };
      yield { event: "done", data: {} };
    }
    await expect(collectStreamReply(gen())).resolves.toBe("final");
  });

  it("error 事件抛出", async () => {
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "error", data: { error: "boom" } };
    }
    await expect(collectStreamReply(gen())).rejects.toThrow("boom");
  });
});
