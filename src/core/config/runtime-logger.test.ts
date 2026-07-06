import { afterEach, describe, expect, it } from "bun:test";
import { createNullSink } from "@freeanima/kernel/logging/null";
import { createLogger } from "@freeanima/kernel/logging";

import {
  getRuntimeLogger,
  registerRuntimeLogger,
  resetRuntimeLoggerForTest,
} from "./runtime-logger.ts";

describe("runtime-logger", () => {
  afterEach(() => {
    resetRuntimeLoggerForTest();
  });

  it("returns fallback logger before registration", () => {
    const logger = getRuntimeLogger();
    expect(logger).toBeDefined();
    expect(() => logger.info("fallback")).not.toThrow();
  });

  it("returns registered logger", () => {
    const custom = createLogger({ level: "error", sinks: [createNullSink()] });
    registerRuntimeLogger(custom);
    expect(getRuntimeLogger()).toBe(custom);
  });

  it("reset restores fallback", () => {
    registerRuntimeLogger(createLogger({ level: "error", sinks: [createNullSink()] }));
    resetRuntimeLoggerForTest();
    expect(getRuntimeLogger()).not.toBeUndefined();
  });
});
