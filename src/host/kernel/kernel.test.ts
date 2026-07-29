import { describe, expect, it } from "bun:test";
import { HookRegistry } from "./hooks/index.ts";
import type { Logger } from "./logging/index.ts";
import { createMemorySink } from "./logging/sinks/memory.ts";
import { createLogger } from "./logging/index.ts";
import { createKernel, Kernel } from "./index.ts";

describe("Kernel", () => {
  it("composes hooks and logger ports", () => {
    const memory = createMemorySink();
    const logger: Logger = createLogger({ sinks: [memory] });
    const hookRegistry = new HookRegistry(logger);
    const kernel = new Kernel(hookRegistry, logger);
    expect(kernel.hookRegistry).toBe(hookRegistry);
    expect(kernel.logger).toBe(logger);
  });

  it("createKernel uses default logger and HookRegistry when omitted", () => {
    const kernel = createKernel();
    expect(kernel.hookRegistry).toBeDefined();
    expect(kernel.logger).toBeDefined();
  });
});
