import { NEST_VERSION } from "@freeanima/service";
import { Command } from "commander";

import { registerServiceCommand } from "./commands/service.ts";
import { registerCredentialCommand } from "./commands/credential.ts";
import { registerCompletionCommand } from "./commands/completion.ts";

/** 构建 CLI 程序（供 parse 与 completion 生成共用） */
export function buildProgram(): Command {
  const program = new Command()
    .name("anima")
    .description("逸灵风 — 数字生命运行时")
    .version(NEST_VERSION, "-V, --version", "显示版本号")
    .showHelpAfterError("(使用 --help 查看用法)");

  registerServiceCommand(program);
  registerCredentialCommand(program);
  registerCompletionCommand(program);

  return program;
}
