import { describe, expect, it } from "bun:test";
import { HookRegistry } from "@freeanima/kernel-hooks";
import { EventBus } from "@freeanima/kernel-eventbus";
import { NullEventQueue } from "@freeanima/kernel-eventbus/null";
import type { Logger } from "@freeanima/kernel-logging";
import { createMemorySink } from "@freeanima/kernel-logging/memory";
import { createLogger } from "@freeanima/kernel-logging";
import { createKernel, Kernel } from "./index.ts";

describe("Kernel", () => {
  it("组合 hooks、eventBus 与 logger 端口", () => {
    const memory = createMemorySink();
    const logger: Logger = createLogger({ sinks: [memory] });
    const hookRegistry = new HookRegistry(logger);
    const eventBus = new EventBus(logger, new NullEventQueue());
    const kernel = new Kernel(hookRegistry, logger, eventBus);
    expect(kernel.hookRegistry).toBe(hookRegistry);
    expect(kernel.eventBus).toBe(eventBus);
    expect(kernel.logger).toBe(logger);
  });

  it("createKernel 未传参时使用默认 logger 与内存 EventBus", () => {
    const kernel = createKernel();
    expect(kernel.hookRegistry).toBeDefined();
    expect(kernel.eventBus).toBeDefined();
    expect(kernel.logger).toBeDefined();
  });

  it("setEventBus 可替换 eventBus 实例", () => {
    const logger: Logger = createLogger({ sinks: [createMemorySink()] });
    const kernel = new Kernel(
      new HookRegistry(logger),
      logger,
      new EventBus(logger, new NullEventQueue()),
    );
    const next = new EventBus(logger, new NullEventQueue());
    kernel.setEventBus(next);
    expect(kernel.eventBus).toBe(next);
  });
});
