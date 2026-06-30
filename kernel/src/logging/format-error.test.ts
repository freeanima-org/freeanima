import { describe, expect, it } from "bun:test";
import { formatError } from "./format-error.ts";

describe("formatError", () => {
  it("Error returns stack when present", () => {
    const err = new Error("boom");
    expect(formatError(err)).toBe(err.stack!);
  });

  it("Error without stack falls back to message", () => {
    const err = new Error("boom");
    delete err.stack;
    expect(formatError(err)).toBe("boom");
  });

  it("string returned as-is", () => {
    expect(formatError("plain text")).toBe("plain text");
  });

  it("plain object JSON-stringified", () => {
    expect(formatError({ code: 503 })).toBe('{"code":503}');
  });

  it("non-JSON-serializable values use String()", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(formatError(circular)).toBe("[object Object]");
  });
});
