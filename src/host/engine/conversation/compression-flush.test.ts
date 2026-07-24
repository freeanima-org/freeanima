import { describe, it } from "bun:test";
import { flushCompressionSummaries } from "../turn/compression-orchestration.ts";

describe("flushCompressionSummaries", () => {
  it("resolves without pending summaries", async () => {
    await flushCompressionSummaries();
    await flushCompressionSummaries("nonexistent");
  });
});
