import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import type { Command } from "commander";
import {
  CLI_UPGRADE_HINT_DOCKER,
  CLI_UPGRADE_HINT_NPM_LOCAL_NO_REPO,
  CLI_UPGRADE_HINT_SOURCE,
  getCliInstallKind,
  resolveAnimaScriptPath,
} from "@freeanima/core/config/cli-install";
import { resolveMonorepoRoot } from "@freeanima/core/config/repo-root";

const NPM_PACKAGE = "@freeanima/cli@latest";

function runCommand(command: string, args: string[], opts?: { cwd?: string }): void {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: opts?.cwd });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function runCliUpgrade(scriptPath?: string): void {
  const kind = getCliInstallKind(scriptPath);
  switch (kind) {
    case "source":
      console.error(CLI_UPGRADE_HINT_SOURCE);
      process.exit(1);
      break;
    case "docker":
      console.error(CLI_UPGRADE_HINT_DOCKER);
      process.exit(1);
      break;
    case "npm-registry":
      runCommand("bun", ["pm", "install", "-g", NPM_PACKAGE]);
      break;
    case "npm-local":
      runNpmLocalUpgrade(scriptPath);
      break;
  }
}

function runNpmLocalUpgrade(scriptPath?: string): void {
  const resolved = resolveAnimaScriptPath(scriptPath);
  const root = resolveMonorepoRoot(dirname(resolved));
  if (!root) {
    console.error(CLI_UPGRADE_HINT_NPM_LOCAL_NO_REPO);
    process.exit(1);
  }
  runCommand("git", ["-C", root, "pull", "--ff-only"]);
  runCommand("bun", ["run", "install:cli:local"], { cwd: root });
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command("upgrade")
    .description("按安装方式升级 FreeAnima CLI（npm / 本地 pack / 手动指引）")
    .action(() => {
      runCliUpgrade();
    });
}
