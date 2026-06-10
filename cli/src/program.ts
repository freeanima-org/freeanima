import { ANIMA_VERSION } from "@freeanima/service";
import { Command } from "commander";

import { registerServiceCommand } from "./commands/service.ts";
import { registerCredentialCommand } from "./commands/credential.ts";
import { registerCompletionCommand } from "./commands/completion.ts";
import { registerMemoryCommand } from "./commands/memory.ts";

/** Build CLI program (shared by parse and completion generation) */
export function buildProgram(): Command {
  const program = new Command()
    .name("anima")
    .description("Free Anima — digital life runtime")
    .version(ANIMA_VERSION, "-V, --version", "show version")
    .showHelpAfterError("(use --help for usage)");

  registerServiceCommand(program);
  registerCredentialCommand(program);
  registerMemoryCommand(program);
  registerCompletionCommand(program);

  return program;
}
