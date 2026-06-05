import { describe, expect, it } from "bun:test";
import { EventBus } from "@freeanima/kernel-eventbus";
import { HookRegistry } from "@freeanima/kernel-hooks";
import { kernel } from "../../src/kernel.ts";

describe("legacy-engine kernel", () => {
  it("kernel.hookRegistry 为 HookRegistry 实例", () => {
    expect(kernel.hookRegistry).toBeInstanceOf(HookRegistry);
  });

  it("kernel.eventBus 为 EventBus 实例", () => {
    expect(kernel.eventBus).toBeInstanceOf(EventBus);
  });

  it("kernel.logger 为 Logger 实例", () => {
    expect(kernel.logger.info).toBeFunction();
  });
});
