import { describe, expect, it } from "bun:test";
import { createLogger } from "@freeanima/logging";
import { createConsoleSink } from "@freeanima/logging/sinks/console";
import { createMemorySink } from "@freeanima/logging/sinks/memory";
import { createNullSink } from "@freeanima/logging/sinks/null";

describe("@freeanima/logging 子路径导出", () => {
  it("sinks 子路径可组合使用", () => {
    const memory = createMemorySink();
    const logger = createLogger({
      level: "debug",
      base: { service: "anima" },
      sinks: [createNullSink(), createConsoleSink({ write: () => {} }), memory],
    });
    logger.with({ component: "test" }).info("api smoke");
    expect(memory.records).toHaveLength(1);
    expect(memory.records[0]?.attributes.service).toBe("anima");
    expect(memory.records[0]?.attributes.component).toBe("test");
  });
});
