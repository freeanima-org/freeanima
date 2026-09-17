import { describe, expect, it } from "bun:test";

import { formatPgVector, parsePgVector } from "./format.ts";

describe("formatPgVector", () => {
  it("serializes to pgvector literal", () => {
    expect(formatPgVector([1, 2, 3])).toBe("[1,2,3]");
  });
});

describe("parsePgVector", () => {
  it("parses string literal", () => {
    expect(parsePgVector("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("accepts number arrays", () => {
    expect(parsePgVector([0.5, -1])).toEqual([0.5, -1]);
  });

  it("returns null for garbage", () => {
    expect(parsePgVector("nope")).toBeNull();
    expect(parsePgVector(null)).toBeNull();
  });
});
