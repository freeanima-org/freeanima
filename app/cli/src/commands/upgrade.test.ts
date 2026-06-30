import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/core/util";
import * as childProcess from "node:child_process";
import { CLI_UPGRADE_HINT_SOURCE } from "@freeanima/core/config/cli-install";

describe("runCliUpgrade", () => {
  const prevArgv1 = process.argv[1];
  const prevExit = process.exit;
  const prevBunInstall = process.env.BUN_INSTALL;
  const tempDirs: string[] = [];

  afterEach(() => {
    mock.restore();
    if (prevArgv1 !== undefined) process.argv[1] = prevArgv1;
    else delete (process.argv as { 1?: string })[1];
    process.exit = prevExit;
    if (prevBunInstall === undefined) delete process.env.BUN_INSTALL;
    else process.env.BUN_INSTALL = prevBunInstall;
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("source link install prints manual hint and exits", async () => {
    const dir = createTempDir("freeanima-upgrade-source-");
    tempDirs.push(dir);
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
    const dir = createTempDir("freeanima-upgrade-npm-");
    tempDirs.push(dir);
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
