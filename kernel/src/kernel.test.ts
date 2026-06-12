import { describe, expect, it } from "bun:test";
import { HookRegistry } from "./hooks/index.ts";
import { EventBus } from "./eventbus/index.ts";
import { NullEventQueue } from "./eventbus/adapters/null.ts";
import type { Logger } from "./logging/index.ts";
import { createMemorySink } from "./logging/sinks/memory.ts";
import { createLogger } from "./logging/index.ts";
import { createKernel, Kernel } from "./index.ts";

describe("Kernel", () => {
  it("composes hooks, eventBus, and logger ports", () => {
    const memory = createMemorySink();
    const logger: Logger = createLogger({ sinks: [memory] });
    const hookRegistry = new HookRegistry(logger);
    const eventBus = new EventBus(logger, new NullEventQueue());
    const kernel = new Kernel(hookRegistry, logger, eventBus);
    expect(kernel.hookRegistry).toBe(hookRegistry);
    expect(kernel.eventBus).toBe(eventBus);
    expect(kernel.logger).toBe(logger);
  });

  it("createKernel uses default logger and memory EventBus when omitted", () => {
    const kernel = createKernel();
    expect(kernel.hookRegistry).toBeDefined();
    expect(kernel.eventBus).toBeDefined();
    expect(kernel.logger).toBeDefined();
  });

  it("setEventBus can replace eventBus instance", () => {
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
