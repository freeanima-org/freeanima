import { describe, it, expect, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  computeWebuiSourceHash,
  resolveBundledWebuiDistDir,
  resolveWebuiAppDir,
} from "./webui-bundle.ts";

describe("computeWebuiSourceHash", () => {
  let appDir: string;
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "freeanima-webui-hash-"));
    appDir = join(repoRoot, "app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, "index.html"), "<html></html>\n");
    writeFileSync(join(repoRoot, "bunfig.toml"), "[serve.static]\n");
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
    const root = mkdtempSync(join(tmpdir(), "freeanima-webui-root-"));
    const legacy = join(root, "connectors", "webui", "app");
    const platform = join(root, "platform", "connectors", "webui", "app");
    mkdirSync(legacy, { recursive: true });
    mkdirSync(platform, { recursive: true });
    writeFileSync(join(legacy, "index.html"), "legacy\n");
    writeFileSync(join(platform, "index.html"), "platform\n");
    expect(resolveWebuiAppDir(root)).toBe(legacy);
  });

  it("falls back to platform/connectors/webui/app in monorepo", () => {
    const root = mkdtempSync(join(tmpdir(), "freeanima-webui-root-"));
    const platform = join(root, "platform", "connectors", "webui", "app");
    mkdirSync(platform, { recursive: true });
    writeFileSync(join(platform, "index.html"), "platform\n");
    expect(resolveWebuiAppDir(root)).toBe(platform);
  });
});

describe("resolveBundledWebuiDistDir", () => {
  it("returns connectors/webui/dist when index.html is valid", () => {
    const root = mkdtempSync(join(tmpdir(), "freeanima-webui-dist-"));
    const dir = join(root, "connectors", "webui", "dist");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), '<script src="/webui/chunk-abc.js"></script>\n');
    expect(resolveBundledWebuiDistDir(root)).toBe(dir);
  });
});
