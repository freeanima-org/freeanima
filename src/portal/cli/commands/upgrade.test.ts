import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "@freeanima/host/core/util/temp-dir";
import { CLI_UPGRADE_HINT_SOURCE } from "@freeanima/host/core/config/cli-install";

describe("runCliUpgrade", () => {
  const prevArgv1 = process.argv[1];
  const prevExit = process.exit.bind(process);
  const tempDirs: string[] = [];

  afterEach(() => {
    mock.restore();
    if (prevArgv1 !== undefined) process.argv[1] = prevArgv1;
    else delete (process.argv as { 1?: string })[1];
    process.exit = prevExit;
    for (const dir of tempDirs.splice(0)) removeTempDir(dir);
  });

  it("source install prints manual hint and exits", async () => {
    const dir = createTempDir("freeanima-upgrade-source-");
    tempDirs.push(dir);
    const cliPath = join(dir, "src", "app", "cli", "cli.ts");
    mkdirSync(join(dir, "src", "app", "cli"), { recursive: true });
    writeFileSync(cliPath, "#!/usr/bin/env bun\n");
    process.argv[1] = cliPath;

    const stderr: string[] = [];
    spyOn(console, "error").mockImplementation((msg: string) => {
      stderr.push(msg);
    });
    let exitCode: number | undefined;
    process.exit = (code?: number) => {
      exitCode = code ?? 0;
      throw new Error("exit");
    };

    const { runCliUpgrade } = await import("./upgrade.ts");
    await expect(runCliUpgrade({ scriptPath: cliPath })).rejects.toThrow("exit");
    expect(exitCode).toBe(1);
    expect(stderr.join("\n")).toContain(CLI_UPGRADE_HINT_SOURCE);
  });
});
