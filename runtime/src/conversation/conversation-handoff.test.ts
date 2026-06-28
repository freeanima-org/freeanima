import { describe, expect, it, mock } from "bun:test";

mock.module("@freeanima/core/db/pg/conversation", () => ({
  listMessages: mock(async () => []),
  loadConversationMeta: mock(async () => null),
}));

import { generateConversationHandoffSummary } from "./conversation-handoff.ts";

describe("generateConversationHandoffSummary", () => {
  it("returns error when conversation has no content", async () => {
    const result = await generateConversationHandoffSummary("nonexistent-session-id");
    expect(result.ok).toBe(false);
  });
});
