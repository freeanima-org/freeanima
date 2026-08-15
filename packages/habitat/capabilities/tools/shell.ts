import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
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

/** @deprecated Use registerShellTools. */
export function registerTerminalTools(toolSets: ToolSetRegistry): void {
  registerShellTools(toolSets);
}

/** @deprecated Folded into registerShellTools (`shell` ToolSet). */
export function registerExecuteCodeTool(_toolSets: ToolSetRegistry): void {}
