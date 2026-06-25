import { describe, it, expect } from "bun:test";
import { corsAllowOrigin, isBundledClientOrigin } from "./cors.ts";

describe("isBundledClientOrigin", () => {
  it("allows localhost and 127.0.0.1 with ports", () => {
    expect(isBundledClientOrigin("http://127.0.0.1:4175")).toBe(true);
    expect(isBundledClientOrigin("http://localhost")).toBe(true);
    expect(isBundledClientOrigin("https://localhost")).toBe(true);
    expect(isBundledClientOrigin("capacitor://localhost")).toBe(true);
  });

  it("rejects arbitrary remote origins", () => {
    expect(isBundledClientOrigin("https://evil.example")).toBe(false);
    expect(isBundledClientOrigin(null)).toBe(false);
  });
});

describe("corsAllowOrigin", () => {
  it("returns origin when allowed", () => {
    expect(corsAllowOrigin("http://127.0.0.1:4175")).toBe("http://127.0.0.1:4175");
  });
});
