import { describe, it, expect } from "bun:test";

const HABITAT_PREFIX = "/habitat";

function resolveHabitatAssetPath(pathname: string): string {
  let rel = pathname.slice(HABITAT_PREFIX.length);
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (rel === "" || !rel.includes(".")) {
    return "index.html";
  }
  return rel;
}

describe("resolveHabitatAssetPath", () => {
  it("maps chunk assets under /habitat", () => {
    expect(resolveHabitatAssetPath("/habitat/chunk-abc123.js")).toBe("chunk-abc123.js");
    expect(resolveHabitatAssetPath("/habitat/chunk-abc123.css")).toBe("chunk-abc123.css");
  });

  it("falls back to index.html for SPA routes", () => {
    expect(resolveHabitatAssetPath("/habitat/")).toBe("index.html");
    expect(resolveHabitatAssetPath("/habitat")).toBe("index.html");
    expect(resolveHabitatAssetPath("/habitat/dashboard")).toBe("index.html");
  });
});
