import { describe, expect, it } from "bun:test";

import { asOptionalString, coerceString } from "./coerce-string.ts";

describe("coerceString", () => {
  it("returns fallback for nullish and objects", () => {
    expect(coerceString(null)).toBe("");
    expect(coerceString(undefined)).toBe("");
    expect(coerceString({})).toBe("");
    expect(coerceString([])).toBe("");
    expect(coerceString(null, "x")).toBe("x");
  });

  it("passes through strings and stringifies primitives", () => {
    expect(coerceString("hi")).toBe("hi");
    expect(coerceString(42)).toBe("42");
    expect(coerceString(true)).toBe("true");
    expect(coerceString(1n)).toBe("1");
  });
});

describe("asOptionalString", () => {
  it("returns string or undefined", () => {
    expect(asOptionalString("a")).toBe("a");
    expect(asOptionalString(1)).toBeUndefined();
    expect(asOptionalString(null)).toBeUndefined();
  });
});
