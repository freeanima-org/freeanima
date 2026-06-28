import { describe, it } from "bun:test";
import { nullPgRepositories } from "@freeanima/core/repos";
import { flushCompressionSummaries } from "../turn/compression-orchestration.ts";

describe("flushCompressionSummaries", () => {
  it("returns immediately when no pending", async () => {
    await flushCompressionSummaries(nullPgRepositories);
    await flushCompressionSummaries(nullPgRepositories, "nonexistent");
  });
});
