import { describe, expect, it } from "bun:test";
import { cacheKeyFor } from "./model-cache.ts";

describe("cacheKeyFor", () => {
  it("uses object_file id when provided", () => {
    expect(cacheKeyFor("/models/1.vrm", 1)).toBe("https://companion-asset.invalid/file/1");
  });

  it("绝对 http(s) URL 原样返回（无 file id）", () => {
    expect(cacheKeyFor("https://cdn.example/a.vrm")).toBe("https://cdn.example/a.vrm");
  });
});
