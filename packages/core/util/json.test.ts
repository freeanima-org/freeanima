import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { formatZodError, safeParseOrNull } from "./json.ts";

describe("safeParseOrNull", () => {
  const schema = z.object({ name: z.string() });

  it("returns parsed data on success", () => {
    expect(safeParseOrNull(schema, { name: "demo" })).toEqual({ name: "demo" });
  });

  it("returns null on failure", () => {
    expect(safeParseOrNull(schema, { name: 1 })).toBeNull();
    expect(safeParseOrNull(schema, null)).toBeNull();
  });
});

describe("formatZodError", () => {
  it("formats first issue with path prefix", () => {
    const result = z.object({ age: z.number() }).safeParse({ age: "x" });
    if (result.success) throw new Error("expected failure");
    expect(formatZodError(result.error)).toMatch(/^age: /);
  });

  it("returns generic message when issues empty", () => {
    expect(formatZodError({ issues: [] })).toBe("validation failed");
  });
});
