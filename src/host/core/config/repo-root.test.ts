import { describe, expect, it, afterEach } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createTempDir, removeTempDir } from "@freeanima/host/core/util/temp-dir";
import { resolveStandaloneInstallRoot, resetRepoRootForTests } from "./repo-root.ts";

describe("resolveStandaloneInstallRoot", () => {
  const prevArgv1 = process.argv[1];
  const tempDirs: string[] = [];

  afterEach(() => {
    if (prevArgv1 !== undefined) process.argv[1] = prevArgv1;
    else delete (process.argv as { 1?: string })[1];
    resetRepoRootForTests();
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("returns exec dir when bunfs argv (no package.json required)", () => {
    const dir = createTempDir("freeanima-standalone-");
    tempDirs.push(dir);
    const bin = join(dir, "anima");
    writeFileSync(bin, "#!/bin/true\n");
    expect(resolveStandaloneInstallRoot(bin, "/$bunfs/root/anima")).toBe(dir);
  });

  it("returns null for non-standalone argv", () => {
    const dir = createTempDir("freeanima-standalone-src-");
    tempDirs.push(dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "@freeanima/cli", version: "0.0.0" }),
    );
    expect(resolveStandaloneInstallRoot(join(dir, "anima"), "/tmp/cli.ts")).toBeNull();
  });
});
