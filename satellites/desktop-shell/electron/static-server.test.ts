import { describe, it, expect } from "bun:test";

const WEBUI_PREFIX = "/webui";

function resolveWebuiAssetPath(pathname: string): string {
  let rel = pathname.slice(WEBUI_PREFIX.length);
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (rel === "" || !rel.includes(".")) {
    return "index.html";
  }
  return rel;
}

describe("resolveWebuiAssetPath", () => {
  it("maps chunk assets under /webui", () => {
    expect(resolveWebuiAssetPath("/webui/chunk-abc123.js")).toBe("chunk-abc123.js");
    expect(resolveWebuiAssetPath("/webui/chunk-abc123.css")).toBe("chunk-abc123.css");
  });

  it("falls back to index.html for SPA routes", () => {
    expect(resolveWebuiAssetPath("/webui/")).toBe("index.html");
    expect(resolveWebuiAssetPath("/webui")).toBe("index.html");
    expect(resolveWebuiAssetPath("/webui/chamber/dashboard")).toBe("index.html");
  });
});
