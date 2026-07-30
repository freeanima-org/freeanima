import { describe, expect, it } from "bun:test";
import { headOkStepData } from "@freeanima/host/kernel/hooks";
import { createTestHookRegistry } from "@freeanima/host/kernel/hooks/testing";
import { messageIncoming } from "./index.ts";

describe("conversation hooks", () => {
  it("messageIncoming qualifiedId", () => {
    expect(messageIncoming.qualifiedId).toBe(
      "@freeanima/host/engine/conversation-hooks/message-incoming",
    );
  });

  it("messageIncoming effect via headOkStepData", async () => {
    const registry = createTestHookRegistry();
    registry.on(
      messageIncoming,
      () => ({
        status: "ok",
        data: { transformedMessage: "hi" },
      }),
      { llm_kind: "conversation" },
    );
    const run = await registry.run(
      messageIncoming,
      {
        conversationId: "s1",
        message: "hello",
        platform: "console",
      },
      { llm_kind: "conversation" },
    );
    expect(headOkStepData(messageIncoming, run.chain)?.transformedMessage).toBe("hi");
  });
});
