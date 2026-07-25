import { describe, expect, it } from "bun:test";

import { cacheKeyFor } from "./model-cache.ts";

describe("cacheKeyFor", () => {
  it("相对 models 路径映射为 https 伪 URL", () => {
    expect(cacheKeyFor("/models/demo.vrm")).toBe("https://companion-asset.invalid/models/demo.vrm");
  });

  it("相对 motions 路径映射为 https 伪 URL", () => {
    expect(cacheKeyFor("motions/walk.vrma")).toBe(
      "https://companion-asset.invalid/motions/walk.vrma",
    );
  });

  it("文件名经 encodeURIComponent", () => {
    expect(cacheKeyFor("/models/foo bar.vrm")).toBe(
      "https://companion-asset.invalid/models/foo%20bar.vrm",
    );
    expect(cacheKeyFor("/models/角色.vrm")).toBe(
      `https://companion-asset.invalid/models/${encodeURIComponent("角色.vrm")}`,
    );
  });

  it("绝对 http(s) URL 原样返回", () => {
    expect(cacheKeyFor("https://cdn.example/a.vrm")).toBe("https://cdn.example/a.vrm");
    expect(cacheKeyFor("http://cdn.example/a.vrm")).toBe("http://cdn.example/a.vrm");
  });
});
