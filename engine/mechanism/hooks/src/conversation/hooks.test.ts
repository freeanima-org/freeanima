import { describe, expect, it } from "bun:test";
import { headOkStepData } from "@freeanima/kernel-hooks";
import { createTestHookRegistry } from "@freeanima/kernel-hooks/testing";
import { messageIncoming } from "./index.ts";

describe("conversation hooks", () => {
  it("messageIncoming qualifiedId", () => {
    expect(messageIncoming.qualifiedId).toBe(
      "@freeanima/engine-conversation-hooks/message-incoming",
    );
  });

  it("messageIncoming effect via headOkStepData", async () => {
    const registry = createTestHookRegistry();
    registry.on(messageIncoming, () => ({
      status: "ok",
      data: { transformedMessage: "hi" },
    }));
    const run = await registry.run(messageIncoming, {
      sessionId: "s1",
      message: "hello",
      platform: "webui",
    });
    expect(headOkStepData(messageIncoming, run.chain)?.transformedMessage).toBe("hi");
  });
});
