import { describe, expect, it } from "bun:test";
import { createHookContext, onMessageIncoming, runMessageIncoming } from "../cordis/index.ts";

describe("conversation hooks", () => {
  it("messageIncoming transform reaches the caller", async () => {
    const ctx = createHookContext();
    onMessageIncoming(ctx, () => ({ transformedMessage: "hi" }));
    const outcome = await runMessageIncoming(ctx, {
      conversationId: "s1",
      message: "hello",
      platform: "console",
    });
    expect(outcome.transformedMessage).toBe("hi");
    expect(outcome.blocked).toBeUndefined();
  });
});
