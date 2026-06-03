import type { Command } from "commander";
import { generateCompletion, SUPPORTED_SHELLS } from "../completion/generate";

export function registerCompletionCommand(root: Command): void {
  root
    .command("completion")
    .description("生成 bash / zsh 补全脚本（写入 stdout）")
    .argument("<shell>", `目标 shell (${SUPPORTED_SHELLS.join(" | ")})`)
    .addHelpText(
      "after",
      `
安装示例:
  eval "$(anima completion bash)"
  source <(anima completion zsh)
`,
    )
    .action((shell: string) => {
      try {
        process.stdout.write(generateCompletion(shell, root));
      } catch (e) {
        console.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      }
    });
}
