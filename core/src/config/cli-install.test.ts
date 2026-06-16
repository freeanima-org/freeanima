import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  formatCliVersion,
  getCliInstallKind,
  isLocalPackDependencySpec,
  resolveAnimaExecutable,
  resolveAnimaScriptPath,
} from "./cli-install.ts";

describe("cli-install", () => {
  const prevArgv1 = process.argv[1];
  const prevBunInstall = process.env.BUN_INSTALL;

  afterEach(() => {
    process.argv[1] = prevArgv1;
    if (prevBunInstall === undefined) delete process.env.BUN_INSTALL;
    else process.env.BUN_INSTALL = prevBunInstall;
  });

  it("getCliInstallKind treats monorepo cli.ts as source", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-install-"));
    const cliPath = join(dir, "cli", "src", "cli.ts");
    mkdirSync(join(dir, "cli", "src"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    process.argv[1] = cliPath;
    expect(getCliInstallKind()).toBe("source");
    expect(formatCliVersion("0.4.0")).toBe("0.4.0 (local)");
  });

  it("getCliInstallKind treats published npm layout as npm-registry", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-npm-"));
    const bunRoot = join(dir, "bun");
    const globalDir = join(bunRoot, "install/global");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "package.json"),
      JSON.stringify({
        name: "bun-global",
        dependencies: { "@freeanima/cli": "^0.4.0" },
      }),
    );
    const cliJs = join(dir, "node_modules", "@freeanima", "cli", "dist", "cli.js");
    mkdirSync(join(dir, "node_modules", "@freeanima", "cli", "dist"), { recursive: true });
    writeFileSync(cliJs, "// cli\n");
    process.env.BUN_INSTALL = bunRoot;
    process.argv[1] = cliJs;
    expect(getCliInstallKind()).toBe("npm-registry");
    expect(formatCliVersion("0.4.0")).toBe("0.4.0");
  });

  it("getCliInstallKind treats local pack global spec as npm-local", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-local-pack-"));
    const bunRoot = join(dir, "bun");
    const globalDir = join(bunRoot, "install/global");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "package.json"),
      JSON.stringify({
        name: "bun-global",
        dependencies: { "@freeanima/cli": "file:/tmp/freeanima-cli-0.4.0.tgz" },
      }),
    );
    const cliJs = join(dir, "node_modules", "@freeanima", "cli", "dist", "cli.js");
    mkdirSync(join(dir, "node_modules", "@freeanima", "cli", "dist"), { recursive: true });
    writeFileSync(cliJs, "// cli\n");
    process.env.BUN_INSTALL = bunRoot;
    process.argv[1] = cliJs;
    expect(getCliInstallKind()).toBe("npm-local");
    expect(formatCliVersion("0.4.0")).toBe("0.4.0 (local-pack)");
  });

  it("isLocalPackDependencySpec detects tarball and file specs", () => {
    expect(isLocalPackDependencySpec("file:/path/pkg.tgz")).toBe(true);
    expect(isLocalPackDependencySpec("/abs/pkg.tgz")).toBe(true);
    expect(isLocalPackDependencySpec("^0.4.0")).toBe(false);
    expect(isLocalPackDependencySpec("0.4.0")).toBe(false);
  });

  it("resolveAnimaScriptPath follows symlink to cli.ts", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-link-"));
    const cliPath = join(dir, "cli", "src", "cli.ts");
    mkdirSync(join(dir, "cli", "src"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    const linkPath = join(dir, "anima-link");
    symlinkSync(cliPath, linkPath);
    expect(resolveAnimaScriptPath(linkPath)).toBe(cliPath);
    expect(getCliInstallKind(linkPath)).toBe("source");
  });

  it("resolveAnimaExecutable splits bun + cli.js", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-spawn-"));
    const cliJs = join(dir, "cli.js");
    writeFileSync(cliJs, "// cli\n");
    process.argv[1] = cliJs;
    expect(resolveAnimaExecutable(["upgrade"])).toEqual({
      command: process.execPath,
      args: [cliJs, "upgrade"],
    });
  });
});
