import { describe, it, expect, afterEach } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util/temp-dir";
import { tryResolveWebDistDir } from "./dist-path.ts";
import { registerEmbeddedWebDist } from "./web-dist-embedded.ts";

describe("tryResolveWebDistDir", () => {
  const tempDirs: string[] = [];
  const GLOBAL_KEY = "__FREEANIMA_EMBEDDED_WEB_DIST__";

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("returns null when explicit dir missing index.html", () => {
    const dir = createTempDir("freeanima-web-dist-");
    tempDirs.push(dir);
    expect(tryResolveWebDistDir(dir)).toBeNull();
  });

  it("returns explicit dir when index.html exists", () => {
    const dir = createTempDir("freeanima-web-dist-");
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), "<html></html>");
    expect(tryResolveWebDistDir(dir)).toBe(dir);
  });

  it("prefers materialized embedded web dist over disk lookup", () => {
    const src = createTempDir("freeanima-web-embed-");
    tempDirs.push(src);
    const indexPath = join(src, "index.html");
    writeFileSync(indexPath, "<html>embedded</html>");
    registerEmbeddedWebDist([{ rel: "index.html", path: indexPath }]);

    const resolved = tryResolveWebDistDir();
    expect(resolved).not.toBeNull();
    if (resolved) tempDirs.push(resolved);
    expect(resolved).toContain("freeanima-web-dist-");
  });
});
