import { ANIMA_VERSION } from "@freeanima/platform";
import { Command } from "commander";

import { registerServiceCommand } from "./commands/service.ts";
import { registerVaultCommand } from "./commands/vault.ts";
import { registerCompletionCommand } from "./commands/completion.ts";
import { registerUpgradeCommand } from "./commands/upgrade.ts";
import { registerWebCommand } from "./commands/web.ts";
import { registerTokenCommand } from "./commands/token.ts";
import { isStandaloneCli } from "./is-standalone-cli.ts";

export type BuildProgramOptions = {
  /** 默认 `isStandaloneCli()`；测试可强制 */
  standalone?: boolean;
};

/** Build CLI program (shared by parse and completion generation) */
export function buildProgram(opts: BuildProgramOptions = {}): Command {
  const standalone = opts.standalone ?? isStandaloneCli();
  const program = new Command()
    .name("anima")
    .description("Free Anima — digital life runtime")
    .showHelpAfterError("(use --help for usage)");

  if (standalone) {
    registerServiceCommand(program);
  }

  registerVaultCommand(program);
  registerUpgradeCommand(program);
  registerWebCommand(program);
  registerTokenCommand(program);
  registerCompletionCommand(program);

  return program;
}

export { ANIMA_VERSION };
