import { describe, expect, it } from "bun:test";
import { HookRegistry } from "@freeanima/hooks";
import { EventBus } from "@freeanima/event-bus";
import { NullEventQueue } from "@freeanima/event-bus/null";
import type { Logger } from "@freeanima/logging";
import { createMemorySink } from "@freeanima/logging/memory";
import { createLogger } from "@freeanima/logging";
import { Kernel } from "./index";

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

  it("setEventBus 可替换 eventBus 实例", () => {
    const logger: Logger = createLogger({ sinks: [createMemorySink()] });
    const kernel = new Kernel(new HookRegistry(logger), logger, new EventBus(logger, new NullEventQueue()));
    const next = new EventBus(logger, new NullEventQueue());
    kernel.setEventBus(next);
    expect(kernel.eventBus).toBe(next);
  });
});
