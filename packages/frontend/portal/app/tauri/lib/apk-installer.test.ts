import { describe, expect, it } from "bun:test";

import { resolveApkProgressTotal } from "./apk-installer.ts";

describe("resolveApkProgressTotal", () => {
  it("prefers Content-Length from plugin", () => {
    expect(resolveApkProgressTotal(42_000_000, 40_000_000)).toBe(42_000_000);
  });

  it("falls back to expectedSize when plugin total missing", () => {
    expect(resolveApkProgressTotal(null, 40_000_000)).toBe(40_000_000);
    expect(resolveApkProgressTotal(0, 40_000_000)).toBe(40_000_000);
    expect(resolveApkProgressTotal(undefined, 40_000_000)).toBe(40_000_000);
  });

  it("returns null when neither side has a positive size", () => {
    expect(resolveApkProgressTotal(null, undefined)).toBeNull();
    expect(resolveApkProgressTotal(-1, 0)).toBeNull();
  });
});
