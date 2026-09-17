import { describe, expect, it } from "bun:test";

import { encodeCompanionAssetPath, parseCompanionAssetPath } from "./companion-asset-url.ts";

describe("encodeCompanionAssetPath", () => {
  it("文件名经 encodeURIComponent", () => {
    expect(encodeCompanionAssetPath("/models/foo bar.vrm")).toBe("/models/foo%20bar.vrm");
  });
});

describe("parseCompanionAssetPath", () => {
  it("解析 models / motions", () => {
    expect(parseCompanionAssetPath("/models/demo.vrm")).toEqual({
      kind: "models",
      fileName: "demo.vrm",
    });
    expect(parseCompanionAssetPath("motions/walk.vrma")).toEqual({
      kind: "motions",
      fileName: "walk.vrma",
    });
  });

  it("绝对 URL 返回 null", () => {
    expect(parseCompanionAssetPath("https://cdn.example/a.vrm")).toBeNull();
  });
});
