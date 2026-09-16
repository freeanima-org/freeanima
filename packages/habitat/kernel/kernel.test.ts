import { describe, expect, it } from "bun:test";
import { Context } from "cordis";
import type { Logger } from "./logging/index.ts";
import { createMemorySink } from "./logging/sinks/memory.ts";
import { createLogger } from "./logging/index.ts";
import { createKernel, Kernel } from "./index.ts";

describe("Kernel", () => {
  it("composes hook context and logger ports", () => {
    const memory = createMemorySink();
    const logger: Logger = createLogger({ sinks: [memory] });
    const ctx = new Context();
    const kernel = new Kernel(ctx, logger);
    expect(kernel.ctx).toBe(ctx);
    expect(kernel.logger).toBe(logger);
  });

  it("createKernel uses default logger and Cordis context when omitted", () => {
    const kernel = createKernel();
    expect(kernel.ctx).toBeDefined();
    expect(kernel.logger).toBeDefined();
  });
});
