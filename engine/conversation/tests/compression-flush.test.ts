import { describe, it } from "bun:test";
import { flushCompressionSummaries } from "../src/conversation.ts";

describe("flushCompressionSummaries", () => {
  it("无 pending 时立即返回", async () => {
    await flushCompressionSummaries();
    await flushCompressionSummaries("nonexistent");
  });
});
