import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as childProcess from "node:child_process";
import { CLI_UPGRADE_HINT_SOURCE } from "@freeanima/core/config/cli-install";

describe("runCliUpgrade", () => {
  const prevArgv1 = process.argv[1];
  const prevExit = process.exit;
  const prevBunInstall = process.env.BUN_INSTALL;

  afterEach(() => {
    process.argv[1] = prevArgv1;
    process.exit = prevExit;
    if (prevBunInstall === undefined) delete process.env.BUN_INSTALL;
    else process.env.BUN_INSTALL = prevBunInstall;
  });

  it("source link install prints manual hint and exits", async () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-upgrade-source-"));
    const cliPath = join(dir, "cli", "src", "cli.ts");
    mkdirSync(join(dir, "cli", "src"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    process.argv[1] = cliPath;

    const stderr: string[] = [];
    spyOn(childProcess, "spawnSync").mockReturnValue({
      status: 0,
      stdout: "",
      stderr: "",
      pid: 0,
      output: [],
      signal: null,
      error: undefined,
    });
    spyOn(console, "error").mockImplementation((msg: string) => {
      stderr.push(msg);
    });
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error("exit");
    }) as typeof process.exit;

    const { runCliUpgrade } = await import("./upgrade.ts");
    expect(() => runCliUpgrade(cliPath)).toThrow("exit");
    expect(exitCode).toBe(1);
    expect(stderr.join("\n")).toContain(CLI_UPGRADE_HINT_SOURCE);
  });

  it("npm-registry install runs bun pm install -g", async () => {
    const dir = mkdtempSync(join(tmpdir(), "freeanima-upgrade-npm-"));
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

    const spawnSpy = spyOn(childProcess, "spawnSync").mockReturnValue({
      status: 0,
      stdout: "",
      stderr: "",
      pid: 0,
      output: [],
      signal: null,
      error: undefined,
    });

    const { runCliUpgrade } = await import("./upgrade.ts");
    runCliUpgrade(cliJs);
    expect(spawnSpy).toHaveBeenCalledWith(
      "bun",
      ["pm", "install", "-g", "@freeanima/cli@latest"],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });
});
