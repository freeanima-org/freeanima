import type { ToolSetRegistry } from "@freeanima/core/tool";
import { buildExecuteCodeToolDefs } from "./execute-code.ts";
import { buildTerminalToolDefs } from "./terminal.ts";

/** Terminal commands, background processes, and subprocess code execution. */
export function registerShellTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "shell",
    "Terminal commands, background processes, and subprocess code execution",
    [...buildTerminalToolDefs(), ...buildExecuteCodeToolDefs()],
  );
}
