import { describe, it, expect, afterEach } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import { resolveStandaloneInstallRoot, resetRepoRootForTests } from "./repo-root.ts";

describe("resolveStandaloneInstallRoot", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
    resetRepoRootForTests();
  });

  it("returns install dir when bunfs argv and package.json is @freeanima/cli", () => {
    const dir = createTempDir("freeanima-standalone-root-");
    tempDirs.push(dir);
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "@freeanima/cli", version: "0.0.0" }),
    );
    const bin = join(dir, "anima");
    expect(resolveStandaloneInstallRoot(bin, "/$bunfs/root/anima")).toBe(dir);
  });

  it("returns null for non-standalone argv", () => {
    const dir = createTempDir("freeanima-standalone-root-");
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "@freeanima/cli", version: "0.0.0" }),
    );
    expect(resolveStandaloneInstallRoot(join(dir, "anima"), "/tmp/cli.ts")).toBeNull();
  });
});
