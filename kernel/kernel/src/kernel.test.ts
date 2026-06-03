import { describe, expect, it } from "bun:test";
import { HookRegistry } from "@freeanima/hooks";
import type { Logger } from "@freeanima/logging";
import { createMemorySink } from "@freeanima/logging/sinks/memory";
import { createLogger } from "@freeanima/logging";
import { Kernel } from "./index";

describe("Kernel", () => {
  it("组合 hooks 与 logger 端口", () => {
    const memory = createMemorySink();
    const logger: Logger = createLogger({ sinks: [memory] });
    const hookRegistry = new HookRegistry(logger);
    const kernel = new Kernel(hookRegistry, logger);
    expect(kernel.hookRegistry).toBe(hookRegistry);
    expect(kernel.logger).toBe(logger);
  });
});
