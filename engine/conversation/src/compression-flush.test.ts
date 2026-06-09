import { describe, it } from "bun:test";
import { nullPgRepositories } from "@freeanima/engine-repos";
import { flushCompressionSummaries } from "./conversation.ts";

describe("flushCompressionSummaries", () => {
  it("无 pending 时立即返回", async () => {
    await flushCompressionSummaries(nullPgRepositories);
    await flushCompressionSummaries(nullPgRepositories, "nonexistent");
  });
});
