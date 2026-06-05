import { registerFileTools } from "./file.ts";
import { registerCredentialTools } from "./credential-tool.ts";
import { registerExecuteCodeTool } from "./execute-code.ts";
import { registerMemoryTools } from "./memory-tools.ts";
import { registerTerminalTools } from "./terminal.ts";
import { registerWebTools } from "./web.ts";
import { registerClarifyTool } from "@freeanima/legacy-clarify";
import { registerCronjobTool } from "./cronjob.ts";
import { registerSkillsTools } from "./skills-tools.ts";
import { registerTodoTool } from "./todo-tool.ts";
import { registerBrowserTools } from "./browser.ts";

let registered = false;

export function registerAllTools(): void {
  if (registered) return;
  registerFileTools();
  registerCredentialTools();
  registerExecuteCodeTool();
  registerMemoryTools();
  registerTerminalTools();
  registerWebTools();
  registerBrowserTools();
  registerClarifyTool();
  registerCronjobTool();
  registerSkillsTools();
  registerTodoTool();
  registered = true;
}

export { registerFileTools } from "./file.ts";
export { registerCredentialTools } from "./credential-tool.ts";
