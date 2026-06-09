import { describe, expect, it } from "bun:test";
import { headOkStepData, HookRegistry, messageIncoming } from "./index.ts";
import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";

describe("domain hooks", () => {
  const nullLogger = () => createLogger({ level: "debug", sinks: [createNullSink()] });

  it("messageIncoming qualifiedId", () => {
    expect(messageIncoming.qualifiedId).toBe("@freeanima/kernel-hooks/hooks/message-incoming");
  });

  it("headOkStepData 读取链头 ok 步 data", async () => {
    const registry = new HookRegistry(nullLogger());
    registry.on(messageIncoming, () => ({
      status: "ok",
      data: { transformedMessage: "[hi]" },
    }));
    const run = await registry.run(messageIncoming, {
      sessionId: "s1",
      message: "hi",
      platform: "parlor",
    });
    expect(headOkStepData(run.chain)?.transformedMessage).toBe("[hi]");
  });
});
