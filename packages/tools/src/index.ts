import { registerFileTools } from "./file.js";
import { registerCredentialTools } from "./credential-tool.js";
import { registerExecuteCodeTool } from "./execute-code.js";
import { registerMemoryTools } from "./memory-tools.js";
import { registerTerminalTools } from "./terminal.js";
import { registerWebTools } from "./web.js";
import { registerClarifyTool } from "@freeanima/legacy-clarify";
import { registerCronjobTool } from "./cronjob.js";
import { registerSkillsTools } from "./skills-tools.js";
import { registerTodoTool } from "./todo-tool.js";
import { registerBrowserTools } from "./browser.js";

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

export { registerFileTools } from "./file.js";
export { registerCredentialTools } from "./credential-tool.js";
