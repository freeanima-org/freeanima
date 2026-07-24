import { describe, expect, it } from "bun:test";
import { collectStreamReply } from "./collect-stream-reply.ts";
import type { StreamEvent } from "./loop-engine.ts";

describe("collectStreamReply", () => {
  it("concatenates tokens and replaces full text on content_replace", async () => {
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "token", data: { content: "hello" } };
      yield { event: "content_replace", data: { content: "final" } };
      yield { event: "done", data: {} };
    }
    await expect(collectStreamReply(gen())).resolves.toBe("final");
  });

  it("throws on error event", async () => {
    async function* gen(): AsyncGenerator<StreamEvent> {
      yield { event: "error", data: { error: "boom" } };
    }
    await expect(collectStreamReply(gen())).rejects.toThrow("boom");
  });
});
