import { describe, expect, it } from "bun:test";

import { formatPgVector } from "./format.ts";

describe("formatPgVector", () => {
  it("序列化为 pgvector 字面量", () => {
    expect(formatPgVector([1, 2, 3])).toBe("[1,2,3]");
  });
});
