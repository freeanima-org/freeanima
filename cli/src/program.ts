import { ANIMA_VERSION } from "@freeanima/service";
import { Command } from "commander";

import { registerServiceCommand } from "./commands/service.ts";
import { registerCredentialCommand } from "./commands/credential.ts";
import { registerCompletionCommand } from "./commands/completion.ts";
import { registerUpdateCommand } from "./commands/update.ts";

/** Build CLI program (shared by parse and completion generation) */
export function buildProgram(): Command {
  const program = new Command()
    .name("anima")
    .description("Free Anima — digital life runtime")
    .showHelpAfterError("(use --help for usage)");

  registerServiceCommand(program);
  registerCredentialCommand(program);
  registerUpdateCommand(program);
  registerCompletionCommand(program);

  return program;
}

export { ANIMA_VERSION };
