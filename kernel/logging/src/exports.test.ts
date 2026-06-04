import { describe, expect, it } from "bun:test";
import { createLogger } from "@freeanima/kernel-logging";
import { createConsoleSink } from "@freeanima/kernel-logging/console";
import { createFileSink } from "@freeanima/kernel-logging/file";
import { createMemorySink } from "@freeanima/kernel-logging/memory";
import { createNullSink } from "@freeanima/kernel-logging/null";

describe("@freeanima/kernel-logging 子路径导出", () => {
  it("sinks 子路径可组合使用", () => {
    const memory = createMemorySink();
    const logger = createLogger({
      level: "debug",
      base: { service: "anima" },
      sinks: [
        createNullSink(),
        createConsoleSink({ write: () => {} }),
        createFileSink({ path: "/tmp/unused.log", append: () => {} }),
        memory,
      ],
    });
    logger.with({ component: "test" }).info("api smoke");
    expect(memory.records).toHaveLength(1);
    expect(memory.records[0]?.attributes.service).toBe("anima");
    expect(memory.records[0]?.attributes.component).toBe("test");
  });
});
