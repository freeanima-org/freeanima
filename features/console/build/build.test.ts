import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import { computeAdminSourceHash, resolveAdminAppDir } from "./build-utils.ts";

describe("computeAdminSourceHash", () => {
  let appDir: string;
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = createTempDir("freeanima-admin-hash-");
    appDir = join(repoRoot, "app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "index.html"), "<html></html>\n");
    writeFileSync(join(repoRoot, "bunfig.toml"), "[serve.static]\n");
  });

  afterEach(() => {
    removeTempDir(repoRoot);
  });

  it("相同内容 hash 稳定", () => {
    const a = computeAdminSourceHash(appDir, repoRoot);
    const b = computeAdminSourceHash(appDir, repoRoot);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("文件内容变更后 hash 变化", () => {
    const before = computeAdminSourceHash(appDir, repoRoot);
    writeFileSync(join(appDir, "index.html"), "<html>changed</html>\n");
    const after = computeAdminSourceHash(appDir, repoRoot);
    expect(after).not.toBe(before);
  });

  it("mtime 变更后 hash 变化", () => {
    const before = computeAdminSourceHash(appDir, repoRoot);
    const path = join(appDir, "index.html");
    const now = Date.now() / 1000;
    utimesSync(path, now - 3600, now - 3600);
    const after = computeAdminSourceHash(appDir, repoRoot);
    expect(after).not.toBe(before);
  });
});

describe("resolveAdminAppDir", () => {
  it("prefers published admin-frontend/app layout", () => {
    const root = createTempDir("freeanima-admin-root-");
    try {
      const publish = join(root, "admin-frontend", "app");
      const monorepo = join(root, "features", "console", "ui", "admin");
      mkdirSync(publish, { recursive: true });
      mkdirSync(monorepo, { recursive: true });
      writeFileSync(join(publish, "index.html"), "publish\n");
      writeFileSync(join(monorepo, "index.html"), "monorepo\n");
      expect(resolveAdminAppDir(root)).toBe(publish);
    } finally {
      removeTempDir(root);
    }
  });

  it("falls back to features/console/ui/admin in monorepo", () => {
    const root = createTempDir("freeanima-admin-root-");
    try {
      const monorepo = join(root, "features", "console", "ui", "admin");
      mkdirSync(monorepo, { recursive: true });
      writeFileSync(join(monorepo, "index.html"), "monorepo\n");
      expect(resolveAdminAppDir(root)).toBe(monorepo);
    } finally {
      removeTempDir(root);
    }
  });
});
