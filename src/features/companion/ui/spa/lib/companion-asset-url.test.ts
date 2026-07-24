import { afterEach, describe, expect, it } from "bun:test";

import {
  encodeCompanionAssetPath,
  parseCompanionAssetPath,
  resolveCompanionAssetUrl,
} from "./companion-asset-url.ts";

function stubPortalShell(habitatUrl: string): void {
  // bun test 无 DOM window；仅注入 resolveHubBaseUrl 所需字段
  (globalThis as { window?: { portalShell?: { habitatUrl?: string } } }).window = {
    portalShell: { habitatUrl },
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("encodeCompanionAssetPath", () => {
  it("编码路径段并保留斜杠", () => {
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

describe("resolveCompanionAssetUrl", () => {
  it("绝对 URL 原样返回", async () => {
    expect(await resolveCompanionAssetUrl("https://cdn.example/a.vrm")).toBe(
      "https://cdn.example/a.vrm",
    );
  });

  it("将 /models 路径映射为 Habitat companion.asset.get", async () => {
    stubPortalShell("http://127.0.0.1:2658");
    const url = await resolveCompanionAssetUrl("/models/demo.vrm");
    expect(url).toContain("/rpc/v1/companion/assets/models/");
    expect(url).toContain("demo.vrm");
  });

  it("将 /motions 路径映射为 Habitat companion.asset.get", async () => {
    stubPortalShell("http://hub.local:9000/");
    const url = await resolveCompanionAssetUrl("/motions/walk.vrma");
    expect(url.startsWith("http://hub.local:9000/rpc/v1/companion/assets/motions/")).toBe(true);
    expect(url).toContain("walk.vrma");
  });
});
