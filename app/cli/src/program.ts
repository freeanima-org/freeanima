import { ANIMA_VERSION } from "@freeanima/platform";
import { Command } from "commander";

import { registerServiceCommand } from "./commands/service.ts";
import { registerVaultCommand } from "./commands/vault.ts";
import { registerCompletionCommand } from "./commands/completion.ts";
import { registerUpgradeCommand } from "./commands/upgrade.ts";
import { registerTunnelCommand } from "./commands/tunnel.ts";
import { registerWebCommand } from "./commands/web.ts";
import { registerTokenCommand } from "./commands/token.ts";

/** Build CLI program (shared by parse and completion generation) */
export function buildProgram(): Command {
  const program = new Command()
    .name("anima")
    .description("Free Anima — digital life runtime")
    .showHelpAfterError("(use --help for usage)");

  registerServiceCommand(program);
  registerVaultCommand(program);
  registerUpgradeCommand(program);
  registerTunnelCommand(program);
  registerWebCommand(program);
  registerTokenCommand(program);
  registerCompletionCommand(program);

  return program;
}

export { ANIMA_VERSION };
