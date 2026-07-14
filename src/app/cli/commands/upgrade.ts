import type { Command } from "commander";
import {
  CLI_UPGRADE_HINT_SOURCE,
  CLI_UPGRADE_HINT_STANDALONE,
  getCliInstallKind,
} from "@freeanima/core/config/cli-install";

export function runCliUpgrade(scriptPath?: string): void {
  const kind = getCliInstallKind(scriptPath);
  if (kind === "standalone") {
    console.error(CLI_UPGRADE_HINT_STANDALONE);
    process.exit(1);
  }
  console.error(CLI_UPGRADE_HINT_SOURCE);
  process.exit(1);
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command("upgrade")
    .description("按安装方式提示如何升级（源码 / standalone 均为手动）")
    .action(() => {
      runCliUpgrade();
    });
}
