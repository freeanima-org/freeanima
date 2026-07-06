import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createTempDir, removeTempDir } from "@freeanima/core/util";

import {
  assessMonorepoWebDist,
  hasShellBridgeAsset,
  isSourceTreeNewerThan,
  SHELL_BRIDGE_DIST_MARKER,
  WEB_DIST_REQUIRED_FILES,
} from "./ensure-dist.ts";

describe("ensure-web-dist", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      removeTempDir(dir);
    }
  });

  function tempRoot(prefix: string): string {
    const dir = createTempDir(prefix);
    tempDirs.push(dir);
    return dir;
  }

  function touch(path: string, mtimeMs: number): void {
    writeFileSync(path, "x");
    const sec = mtimeMs / 1000;
    utimesSync(path, sec, sec);
  }

  function writeShellBridgeAsset(dist: string, mtimeMs: number): void {
    const assets = join(dist, "assets");
    mkdirSync(assets, { recursive: true });
    touch(join(assets, "shell-bridge-deadbeef.js"), mtimeMs);
  }

  it("assessMonorepoWebDist 无 dist 时需要 rebuild", () => {
    const root = tempRoot("web-dist-none-");
    const result = assessMonorepoWebDist(root, null);
    expect(result.needsRebuild).toBe(true);
    expect(result.missing).toEqual([...WEB_DIST_REQUIRED_FILES, SHELL_BRIDGE_DIST_MARKER]);
  });

  it("assessMonorepoWebDist 缺少 shell-bridge 产物时需要 rebuild", () => {
    const root = tempRoot("web-dist-missing-");
    const dist = join(root, "dist");
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dist, "index.html"), "<html></html>");
    writeFileSync(join(dist, "manifest.webmanifest"), "{}");
    writeFileSync(join(dist, "sw.js"), "// sw");

    const result = assessMonorepoWebDist(root, dist);
    expect(result.needsRebuild).toBe(true);
    expect(result.missing).toContain(SHELL_BRIDGE_DIST_MARKER);
  });

  it("hasShellBridgeAsset 识别 assets/shell-bridge-*.js", () => {
    const root = tempRoot("web-dist-bridge-");
    const dist = join(root, "dist");
    writeShellBridgeAsset(dist, Date.now());
    expect(hasShellBridgeAsset(dist)).toBe(true);
  });

  it("assessMonorepoWebDist 源码比 dist 新时需要 rebuild", () => {
    const root = tempRoot("web-dist-stale-");
    const dist = join(root, "dist");
    mkdirSync(dist, { recursive: true });
    const distTime = Date.now() - 60_000;
    touch(join(dist, "index.html"), distTime);
    writeShellBridgeAsset(dist, distTime);
    touch(join(dist, "manifest.webmanifest"), distTime);
    touch(join(dist, "sw.js"), distTime);

    const sourceRoot = join(root, "src/app/shell/web");
    mkdirSync(sourceRoot, { recursive: true });
    touch(join(sourceRoot, "vite.config.ts"), distTime + 1000);

    const result = assessMonorepoWebDist(root, dist);
    expect(result.needsRebuild).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("assessMonorepoWebDist dist 完整且源码未变时不需要 rebuild", () => {
    const root = tempRoot("web-dist-fresh-");
    const dist = join(root, "dist");
    mkdirSync(dist, { recursive: true });
    const distTime = Date.now();
    touch(join(dist, "index.html"), distTime);
    writeShellBridgeAsset(dist, distTime);
    touch(join(dist, "manifest.webmanifest"), distTime);
    touch(join(dist, "sw.js"), distTime);

    const sourceRoot = join(root, "src/app/shell/web");
    mkdirSync(sourceRoot, { recursive: true });
    touch(join(sourceRoot, "vite.config.ts"), distTime - 1000);

    const result = assessMonorepoWebDist(root, dist);
    expect(result.needsRebuild).toBe(false);
  });

  it("isSourceTreeNewerThan 跳过 node_modules", () => {
    const root = tempRoot("web-dist-skip-");
    const since = Date.now();
    mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
    touch(join(root, "node_modules", "pkg", "index.js"), since + 5000);
    touch(join(root, "ok.ts"), since - 1000);

    expect(isSourceTreeNewerThan(root, since)).toBe(false);
  });
});
