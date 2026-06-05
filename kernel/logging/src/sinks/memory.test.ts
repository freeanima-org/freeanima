import { describe, expect, it } from "bun:test";
import { createMemorySink } from "./memory.ts";

describe("createMemorySink", () => {
  it("初始 records 为空", () => {
    const sink = createMemorySink();
    expect(sink.records).toEqual([]);
  });

  it("emit 追加完整 LogRecord", () => {
    const sink = createMemorySink();
    const record = {
      level: "warn" as const,
      message: "slow",
      attributes: { component: "db", latencyMs: 120 },
      timestamp: 42,
    };
    sink.emit(record);
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toEqual(record);
  });

  it("按 emit 顺序累积", () => {
    const sink = createMemorySink();
    sink.emit({
      level: "info",
      message: "a",
      attributes: {},
      timestamp: 1,
    });
    sink.emit({
      level: "error",
      message: "b",
      attributes: {},
      timestamp: 2,
    });
    expect(sink.records.map((r) => r.message)).toEqual(["a", "b"]);
  });
});
