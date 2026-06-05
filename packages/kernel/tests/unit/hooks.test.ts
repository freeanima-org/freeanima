import { describe, expect, it } from "bun:test";
import { headOkStepData, HookRegistry } from "@freeanima/kernel-hooks";
import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";
import { messageIncoming } from "../../src/index.ts";

describe("legacy-kernel hooks", () => {
  const nullLogger = () => createLogger({ level: "debug", sinks: [createNullSink()] });

  it("hook token 设置 qualifiedId", () => {
    expect(messageIncoming.qualifiedId).toBe("@freeanima/legacy-kernel/hooks/message-incoming");
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

  it("blocked 时 blockedMessage 为短路步 message", async () => {
    const registry = new HookRegistry(nullLogger());
    registry.on(messageIncoming, () => ({
      status: "ok",
      blocked: true,
      message: "wait",
    }));
    const run = await registry.run(messageIncoming, {
      sessionId: "s1",
      message: "hi",
      platform: "parlor",
    });
    expect(run.blocked).toBe(true);
    expect(run.blockedMessage).toBe("wait");
  });
});
