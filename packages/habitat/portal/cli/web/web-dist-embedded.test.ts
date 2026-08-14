import { describe, it, expect, afterEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/habitat/core/util/temp-dir";
import {
  getRegisteredEmbeddedWebDist,
  materializeEmbeddedWebDist,
  registerEmbeddedWebDist,
} from "./web-dist-embedded.ts";

describe("web-dist-embedded", () => {
  const tempDirs: string[] = [];
  const GLOBAL_KEY = "__FREEANIMA_EMBEDDED_WEB_DIST__";

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("materializeEmbeddedWebDist preserves relative paths", () => {
    const src = createTempDir("freeanima-web-embed-src-");
    tempDirs.push(src);
    mkdirSync(join(src, "assets"), { recursive: true });
    const indexPath = join(src, "index.html");
    const assetPath = join(src, "assets", "a.js");
    writeFileSync(indexPath, "<html></html>");
    writeFileSync(assetPath, "console.log(1)");

    const dir = materializeEmbeddedWebDist([
      { rel: "index.html", path: indexPath },
      { rel: "assets/a.js", path: assetPath },
    ]);
    tempDirs.push(dir);

    expect(existsSync(join(dir, "index.html"))).toBe(true);
    expect(readFileSync(join(dir, "assets/a.js"), "utf8")).toBe("console.log(1)");
  });

  it("registerEmbeddedWebDist exposes files on globalThis", () => {
    registerEmbeddedWebDist([{ rel: "index.html", path: "/x/index.html" }]);
    expect(getRegisteredEmbeddedWebDist()).toEqual([{ rel: "index.html", path: "/x/index.html" }]);
  });
});
