import { describe, expect, it } from "bun:test";
import { createLogger } from "../logging/index.ts";
import { createConsoleSink } from "../logging/sinks/console.ts";
import { createFileSink } from "../logging/sinks/file.ts";
import { createMemorySink } from "../logging/sinks/memory.ts";
import { createNullSink } from "../logging/sinks/null.ts";

describe("@freeanima/kernel/logging subpath exports", () => {
  it("sinks subpath composes", () => {
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
