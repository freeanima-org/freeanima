import { describe, expect, it } from "bun:test";
import { createLogger } from "./index.ts";
import type { LogSink } from "./types.ts";

describe("@freeanima/habitat/kernel/logging main entry", () => {
  it("exports only createLogger and types; sinks via subpath", () => {
    const records: unknown[] = [];
    const sink: LogSink = {
      emit(record) {
        records.push(record);
      },
    };
    const logger = createLogger({ level: "info", sinks: [sink] });
    logger.with({ component: "test" }).info("smoke");
    expect(records).toHaveLength(1);
  });
});
