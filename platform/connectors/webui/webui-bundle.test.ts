import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import {
  computeWebuiSourceHash,
  resolveBundledWebuiDistDir,
  resolveWebuiAppDir,
} from "./webui-bundle.ts";

describe("computeWebuiSourceHash", () => {
  let appDir: string;
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = createTempDir("freeanima-webui-hash-");
    appDir = join(repoRoot, "app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "index.html"), "<html></html>\n");
    writeFileSync(join(repoRoot, "bunfig.toml"), "[serve.static]\n");
  });

  afterEach(() => {
    removeTempDir(repoRoot);
  });

  it("相同内容 hash 稳定", () => {
    const a = computeWebuiSourceHash(appDir, repoRoot);
    const b = computeWebuiSourceHash(appDir, repoRoot);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("文件内容变更后 hash 变化", () => {
    const before = computeWebuiSourceHash(appDir, repoRoot);
    writeFileSync(join(appDir, "index.html"), "<html>changed</html>\n");
    const after = computeWebuiSourceHash(appDir, repoRoot);
    expect(after).not.toBe(before);
  });

  it("mtime 变更后 hash 变化", () => {
    const before = computeWebuiSourceHash(appDir, repoRoot);
    const path = join(appDir, "index.html");
    const now = Date.now() / 1000;
    utimesSync(path, now - 3600, now - 3600);
    const after = computeWebuiSourceHash(appDir, repoRoot);
    expect(after).not.toBe(before);
  });
});

describe("resolveWebuiAppDir", () => {
  it("prefers published connectors/webui/app layout", () => {
    const root = createTempDir("freeanima-webui-root-");
    try {
      const legacy = join(root, "connectors", "webui", "app");
      const platform = join(root, "platform", "connectors", "webui", "app");
      mkdirSync(legacy, { recursive: true });
      mkdirSync(platform, { recursive: true });
      writeFileSync(join(legacy, "index.html"), "legacy\n");
      writeFileSync(join(platform, "index.html"), "platform\n");
      expect(resolveWebuiAppDir(root)).toBe(legacy);
    } finally {
      removeTempDir(root);
    }
  });

  it("falls back to platform/connectors/webui/app in monorepo", () => {
    const root = createTempDir("freeanima-webui-root-");
    try {
      const platform = join(root, "platform", "connectors", "webui", "app");
      mkdirSync(platform, { recursive: true });
      writeFileSync(join(platform, "index.html"), "platform\n");
      expect(resolveWebuiAppDir(root)).toBe(platform);
    } finally {
      removeTempDir(root);
    }
  });
});

describe("resolveBundledWebuiDistDir", () => {
  it("returns connectors/webui/dist when index.html is valid", () => {
    const root = createTempDir("freeanima-webui-dist-");
    try {
      const dir = join(root, "connectors", "webui", "dist");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "index.html"), '<script src="/webui/chunk-abc.js"></script>\n');
      expect(resolveBundledWebuiDistDir(root)).toBe(dir);
    } finally {
      removeTempDir(root);
    }
  });
});
