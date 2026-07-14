import { describe, it, expect, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import {
  formatCliVersion,
  getCliInstallKind,
  isStandaloneExecutable,
  resolveAnimaExecutable,
  resolveAnimaScriptPath,
} from "./cli-install.ts";

describe("cli-install", () => {
  const prevArgv1 = process.argv[1];
  const tempDirs: string[] = [];

  afterEach(() => {
    if (prevArgv1 !== undefined) process.argv[1] = prevArgv1;
    else delete (process.argv as { 1?: string })[1];
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("isStandaloneExecutable detects bunfs argv when probing paths", () => {
    expect(isStandaloneExecutable("/$bunfs/root/anima")).toBe(true);
    expect(isStandaloneExecutable("/home/feng/workspace/freeanima/src/app/cli/cli.ts")).toBe(false);
  });

  it("isStandaloneExecutable uses Bun.isStandaloneExecutable for process argv", () => {
    // 源码/`bun test` 下应为 false；与显式 bunfs 探测互补
    expect(isStandaloneExecutable()).toBe(false);
  });

  it("getCliInstallKind treats monorepo cli.ts as source", () => {
    const dir = createTempDir("freeanima-cli-install-");
    tempDirs.push(dir);
    const cliPath = join(dir, "cli", "src", "app", "cli", "cli.ts");
    mkdirSync(join(dir, "cli", "src", "app", "cli"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    process.argv[1] = cliPath;
    // path must end with /src/app/cli/cli.ts — use real layout suffix
    const linked = join(dir, "src", "app", "cli", "cli.ts");
    mkdirSync(join(dir, "src", "app", "cli"), { recursive: true });
    writeFileSync(linked, "#!/usr/bin/env bun\n");
    process.argv[1] = linked;
    expect(getCliInstallKind()).toBe("source");
    expect(formatCliVersion("0.4.0")).toBe("0.4.0 (local)");
  });

  it("getCliInstallKind treats bunfs argv as standalone", () => {
    process.argv[1] = "/$bunfs/root/anima";
    expect(getCliInstallKind()).toBe("standalone");
    expect(formatCliVersion("0.4.0")).toBe("0.4.0 (standalone)");
  });

  it("resolveAnimaScriptPath follows symlink to cli.ts", () => {
    const dir = createTempDir("freeanima-cli-link-");
    tempDirs.push(dir);
    const cliPath = join(dir, "src", "app", "cli", "cli.ts");
    mkdirSync(join(dir, "src", "app", "cli"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/env bun\n");
    const linkPath = join(dir, "anima-link");
    symlinkSync(cliPath, linkPath);
    expect(resolveAnimaScriptPath(linkPath)).toBe(cliPath);
    expect(getCliInstallKind(linkPath)).toBe("source");
  });

  it("resolveAnimaExecutable splits bun + cli.ts", () => {
    const dir = createTempDir("freeanima-cli-spawn-");
    tempDirs.push(dir);
    const cliTs = join(dir, "cli.ts");
    writeFileSync(cliTs, "// cli\n");
    process.argv[1] = cliTs;
    expect(resolveAnimaExecutable(["upgrade"])).toEqual({
      command: process.execPath,
      args: [cliTs, "upgrade"],
    });
  });
});
