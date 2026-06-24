import { describe, it, expect } from "bun:test";

const ADMIN_PREFIX = "/admin";

function resolveAdminAssetPath(pathname: string): string {
  let rel = pathname.slice(ADMIN_PREFIX.length);
  if (rel.startsWith("/")) rel = rel.slice(1);
  if (rel === "" || !rel.includes(".")) {
    return "index.html";
  }
  return rel;
}

describe("resolveAdminAssetPath", () => {
  it("maps chunk assets under /admin", () => {
    expect(resolveAdminAssetPath("/admin/chunk-abc123.js")).toBe("chunk-abc123.js");
    expect(resolveAdminAssetPath("/admin/chunk-abc123.css")).toBe("chunk-abc123.css");
  });

  it("falls back to index.html for SPA routes", () => {
    expect(resolveAdminAssetPath("/admin/")).toBe("index.html");
    expect(resolveAdminAssetPath("/admin")).toBe("index.html");
    expect(resolveAdminAssetPath("/admin/dashboard")).toBe("index.html");
  });
});
