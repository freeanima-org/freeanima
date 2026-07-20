import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util/temp-dir";
import { computeConsoleSourceHash, resolveConsoleAppDir } from "./build-utils.ts";

describe("computeConsoleSourceHash", () => {
  let appDir: string;
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = createTempDir("freeanima-console-hash-");
    appDir = join(repoRoot, "app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "index.html"), "<html></html>\n");
    writeFileSync(join(repoRoot, "bunfig.toml"), "[serve.static]\n");
  });

  afterEach(() => {
    removeTempDir(repoRoot);
  });

  it("相同内容 hash 稳定", () => {
    const a = computeConsoleSourceHash(appDir, repoRoot);
    const b = computeConsoleSourceHash(appDir, repoRoot);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("文件内容变更后 hash 变化", () => {
    const before = computeConsoleSourceHash(appDir, repoRoot);
    writeFileSync(join(appDir, "index.html"), "<html>changed</html>\n");
    const after = computeConsoleSourceHash(appDir, repoRoot);
    expect(after).not.toBe(before);
  });

  it("mtime 变更后 hash 变化", () => {
    const before = computeConsoleSourceHash(appDir, repoRoot);
    const path = join(appDir, "index.html");
    const now = Date.now() / 1000;
    utimesSync(path, now - 3600, now - 3600);
    const after = computeConsoleSourceHash(appDir, repoRoot);
    expect(after).not.toBe(before);
  });
});

describe("resolveConsoleAppDir", () => {
  it("returns features/habitat/ui/habitat in monorepo", () => {
    const root = createTempDir("freeanima-console-root-");
    try {
      const monorepo = join(root, "src/features", "habitat", "ui", "habitat");
      mkdirSync(monorepo, { recursive: true });
      writeFileSync(join(monorepo, "index.html"), "monorepo\n");
      expect(resolveConsoleAppDir(root)).toBe(monorepo);
    } finally {
      removeTempDir(root);
    }
  });
});
