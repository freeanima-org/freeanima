import { describe, it, expect } from "bun:test";

const CONSOLE_PREFIX = "/console";

function resolveConsoleAssetPath(pathname: string): string {
  let rel = pathname.slice(CONSOLE_PREFIX.length);
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (rel === "" || !rel.includes(".")) {
    return "index.html";
  }
  return rel;
}

describe("resolveConsoleAssetPath", () => {
  it("maps chunk assets under /console", () => {
    expect(resolveConsoleAssetPath("/console/chunk-abc123.js")).toBe("chunk-abc123.js");
    expect(resolveConsoleAssetPath("/console/chunk-abc123.css")).toBe("chunk-abc123.css");
  });

  it("falls back to index.html for SPA routes", () => {
    expect(resolveConsoleAssetPath("/console/")).toBe("index.html");
    expect(resolveConsoleAssetPath("/console")).toBe("index.html");
    expect(resolveConsoleAssetPath("/console/dashboard")).toBe("index.html");
  });
});
