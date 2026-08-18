import { describe, expect, it } from "bun:test";

import { uint8ToBase64 } from "./blob-saver.ts";

describe("uint8ToBase64", () => {
  it("round-trips ASCII", () => {
    const bytes = new TextEncoder().encode("hi");
    expect(uint8ToBase64(bytes)).toBe(btoa("hi"));
    expect(atob(uint8ToBase64(bytes))).toBe("hi");
  });
});
