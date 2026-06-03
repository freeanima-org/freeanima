import { describe, expect, it } from "bun:test";
import { createNullSink } from "./null.js";
import type { LogRecord } from "../types.js";

const sampleRecord: LogRecord = {
  level: "info",
  message: "ignored",
  attributes: { component: "test" },
  timestamp: 0,
};

describe("createNullSink", () => {
  it("emit 不抛错、无副作用", () => {
    const sink = createNullSink();
    expect(() => sink.emit(sampleRecord)).not.toThrow();
  });

  it("多次 emit 仍安全", () => {
    const sink = createNullSink();
    sink.emit(sampleRecord);
    sink.emit({ ...sampleRecord, level: "error" });
  });
});
