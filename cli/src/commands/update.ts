import { spawnSync } from "node:child_process";
import type { Command } from "commander";
import { getCliInstallKind } from "@freeanima/core/config/cli-install";

const NPM_PACKAGE = "@freeanima/cli@latest";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Update @freeanima/cli from npm (disabled for local link installs)")
    .action(() => {
      if (getCliInstallKind() === "local") {
        console.error("本地 link 安装不支持 update，请使用 git pull 或 link:global 等方式升级。");
        process.exit(1);
      }

      const result = spawnSync("bun", ["pm", "install", "-g", NPM_PACKAGE], {
        stdio: "inherit",
      });
      if (result.status !== 0) {
        process.exit(result.status ?? 1);
      }
    });
}
