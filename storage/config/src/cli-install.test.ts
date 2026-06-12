import { describe, it, expect, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  formatCliVersion,
  getCliInstallKind,
  resolveAnimaExecutable,
  resolveAnimaScriptPath,
} from "./cli-install.ts";

describe("cli-install", () => {
  const prevArgv1 = process.argv[1];

  afterEach(() => {
    process.argv[1] = prevArgv1;
  });

  it("getCliInstallKind treats monorepo cli.ts as local", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-install-"));
    const cliPath = join(dir, "cli", "src", "cli.ts");
    mkdirSync(join(dir, "cli", "src"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    process.argv[1] = cliPath;
    expect(getCliInstallKind()).toBe("local");
    expect(formatCliVersion("0.4.0")).toBe("0.4.0 (local)");
  });

  it("getCliInstallKind treats published npm layout as npm", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-npm-"));
    const cliJs = join(dir, "node_modules", "@freeanima", "cli", "dist", "cli.js");
    mkdirSync(join(dir, "node_modules", "@freeanima", "cli", "dist"), { recursive: true });
    writeFileSync(cliJs, "// cli\n");
    process.argv[1] = cliJs;
    expect(getCliInstallKind()).toBe("npm");
    expect(formatCliVersion("0.4.0")).toBe("0.4.0");
  });

  it("resolveAnimaScriptPath follows symlink to cli.ts", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-link-"));
    const cliPath = join(dir, "cli", "src", "cli.ts");
    mkdirSync(join(dir, "cli", "src"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    const linkPath = join(dir, "anima-link");
    symlinkSync(cliPath, linkPath);
    expect(resolveAnimaScriptPath(linkPath)).toBe(cliPath);
    expect(getCliInstallKind(linkPath)).toBe("local");
  });

  it("resolveAnimaExecutable splits bun + cli.js", () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-cli-spawn-"));
    const cliJs = join(dir, "cli.js");
    writeFileSync(cliJs, "// cli\n");
    process.argv[1] = cliJs;
    expect(resolveAnimaExecutable(["update"])).toEqual({
      command: process.execPath,
      args: [cliJs, "update"],
    });
  });
});
