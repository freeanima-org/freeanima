import { describe, expect, it, afterEach } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createTempDir, removeTempDir } from "@freeanima/habitat/core/util/temp-dir";
import {
  createComponentBuildMeta,
  formatBuildMetaLines,
  parseComponentBuildMeta,
  readBuildMetaFile,
  resolveGitBuildInfo,
} from "./build-meta.ts";
import { parseComponentBuildMeta as parseComponentBuildMetaBrowser } from "./build-meta.parse.ts";

describe("build-meta", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("parseComponentBuildMeta validates shape", () => {
    expect(parseComponentBuildMeta(null)).toBeNull();
    expect(
      parseComponentBuildMeta({
        component: "service",
        version: "0.8.3",
        channel: "local",
      }),
    ).toEqual({
      component: "service",
      version: "0.8.3",
      channel: "local",
    });
    expect(
      parseComponentBuildMeta({
        component: "service",
        version: "0.8.3",
        channel: "dev",
      }),
    ).toEqual({
      component: "service",
      version: "0.8.3",
      channel: "local",
    });
    expect(
      parseComponentBuildMeta({
        component: "native",
        shell: "desktop",
        version: "0.8.3",
        channel: "release",
        built_at: "2026-07-08T00:00:00.000Z",
        git: { commit: "abc123", branch: "main", dirty: false },
      }),
    ).toMatchObject({
      component: "native",
      shell: "desktop",
      channel: "release",
      git: { commit: "abc123", branch: "main", dirty: false },
    });
    expect(
      parseComponentBuildMeta({
        component: "web",
        version: "0.8.3",
        channel: "prod",
      }),
    ).toMatchObject({ channel: "release" });
    expect(
      parseComponentBuildMeta({
        component: "native",
        version: "0.8.3",
        channel: "release",
      }),
    ).toBeNull();
  });

  it("resolveGitBuildInfo prefers CI env", () => {
    const git = resolveGitBuildInfo({
      env: {
        GITHUB_SHA: "0123456789abcdef0123456789abcdef01234567",
        GITHUB_REF_NAME: "main",
      },
    });
    expect(git?.commit).toBe("0123456789ab");
    expect(git?.commit_full).toContain("0123456789");
    expect(git?.branch).toBe("main");
  });

  it("readBuildMetaFile reads JSON from disk", () => {
    const dir = createTempDir("freeanima-build-meta-");
    tempDirs.push(dir);
    const path = join(dir, "build-meta.json");
    writeFileSync(
      path,
      JSON.stringify({
        component: "web",
        version: "0.8.3",
        channel: "release",
        built_at: "2026-07-08T00:00:00.000Z",
      }),
    );
    expect(readBuildMetaFile(path)?.component).toBe("web");
    expect(readBuildMetaFile(join(dir, "missing.json"))).toBeNull();
  });

  it("createComponentBuildMeta stamps local version from package.json", () => {
    const dir = createTempDir("freeanima-build-meta-root-");
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "freeanima", version: "1.2.3" }),
    );
    const meta = createComponentBuildMeta({
      component: "service",
      channel: "local",
      repoRoot: dir,
      includeBuiltAt: false,
      env: {},
    });
    expect(meta.version).toMatch(/^1\.2\.3-local\+\d{12}$/);
    expect(meta.channel).toBe("local");
    expect(meta.built_at).toBeUndefined();
  });

  it("createComponentBuildMeta prefers FREEANIMA_BUILD_VERSION via env", () => {
    const dir = createTempDir("freeanima-build-meta-env-");
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "freeanima", version: "1.2.3" }),
    );
    const meta = createComponentBuildMeta({
      component: "service",
      channel: "canary",
      repoRoot: dir,
      includeBuiltAt: false,
      env: { FREEANIMA_BUILD_VERSION: "1.2.4-canary+202601010000" },
    });
    expect(meta.version).toBe("1.2.4-canary+202601010000");
  });

  it("formatBuildMetaLines renders key fields", () => {
    const lines = formatBuildMetaLines({
      component: "service",
      version: "0.8.3",
      channel: "release",
      built_at: "2026-07-08T00:00:00.000Z",
      git: { commit: "abc123", branch: "main", dirty: true },
    });
    expect(lines).toContain("version 0.8.3");
    expect(lines).toContain("channel release");
    expect(lines.some((l) => l.startsWith("commit abc123"))).toBe(true);
    expect(lines).toContain("branch main");
    expect(lines).toContain("dirty yes");
    expect(lines).toContain("built 2026-07-08T00:00:00.000Z");
  });

  it("parse module matches node re-export", () => {
    const raw = { component: "service", version: "0.8.3", channel: "local" };
    expect(parseComponentBuildMetaBrowser(raw)).toEqual(parseComponentBuildMeta(raw));
    expect(parseComponentBuildMeta({ ...raw, channel: "dev" })).toEqual(
      parseComponentBuildMeta(raw),
    );
  });
});
