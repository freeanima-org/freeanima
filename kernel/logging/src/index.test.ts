import { describe, expect, it } from "bun:test";
import { createLogger } from "./index.js";
import type { LogSink } from "./types.js";

describe("@freeanima/kernel-logging 主入口", () => {
  it("仅导出 createLogger 与类型，sink 走子路径", () => {
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
