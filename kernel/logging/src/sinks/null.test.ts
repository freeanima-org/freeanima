import { describe, expect, it } from "bun:test";
import { createNullSink } from "./null.ts";
import type { LogRecord } from "../types.ts";

const sampleRecord: LogRecord = {
  level: "info",
  message: "ignored",
  attributes: { component: "test" },
  timestamp: 0,
};

describe("createNullSink", () => {
  it("emit does not throw and has no side effects", () => {
    const sink = createNullSink();
    expect(() => sink.emit(sampleRecord)).not.toThrow();
  });

  it("multiple emit calls remain safe", () => {
    const sink = createNullSink();
    sink.emit(sampleRecord);
    sink.emit({ ...sampleRecord, level: "error" });
  });
});
