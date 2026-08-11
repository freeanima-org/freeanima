import { describe, expect, it } from "bun:test";

import { formatPgVector } from "./format.ts";

describe("formatPgVector", () => {
  it("serializes to pgvector literal", () => {
    expect(formatPgVector([1, 2, 3])).toBe("[1,2,3]");
  });
});
