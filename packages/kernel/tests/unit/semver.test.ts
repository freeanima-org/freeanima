import { describe, it, expect } from "vitest";
import { bumpSemver, parseSemver } from "@freeanima/core";

describe("semver", () => {
  it("parseSemver 解析三位版本", () => {
    expect(parseSemver("0.2.0")).toEqual({ major: 0, minor: 2, patch: 0 });
  });

  it("parseSemver 拒绝非法版本", () => {
    expect(() => parseSemver("v0.2.0")).toThrow(/无效的语义化版本/);
    expect(() => parseSemver("0.2")).toThrow(/无效的语义化版本/);
  });

  it("bumpSemver patch/minor/major", () => {
    expect(bumpSemver("0.2.0", "patch")).toBe("0.2.1");
    expect(bumpSemver("0.2.0", "minor")).toBe("0.3.0");
    expect(bumpSemver("0.2.0", "major")).toBe("1.0.0");
  });
});
