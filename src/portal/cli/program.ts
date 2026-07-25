import { ANIMA_VERSION } from "@freeanima/host/platform";
import { Command } from "commander";

import { registerServiceCommand } from "./commands/service.ts";
import { registerCompletionCommand } from "./commands/completion.ts";
import { registerUpgradeCommand } from "./commands/upgrade.ts";
import { registerVersionsCommand } from "./commands/versions.ts";
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

  registerUpgradeCommand(program);
  registerVersionsCommand(program);
  registerTokenCommand(program);
  registerCompletionCommand(program);

  return program;
}

export { ANIMA_VERSION };
