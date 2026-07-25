import type { Command } from "commander";
import { generateCompletion, SUPPORTED_SHELLS } from "../completion/generate.ts";

export function registerCompletionCommand(root: Command): void {
  root
    .command("completion")
    .description("Generate bash / zsh completion script (stdout)")
    .argument("<shell>", `Target shell (${SUPPORTED_SHELLS.join(" | ")})`)
    .addHelpText(
      "after",
      `
Install examples:
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
