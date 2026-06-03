import { registerFileTools } from "./file";
import { registerCredentialTools } from "./credential-tool";
import { registerExecuteCodeTool } from "./execute-code";
import { registerMemoryTools } from "./memory-tools";
import { registerTerminalTools } from "./terminal";
import { registerWebTools } from "./web";
import { registerClarifyTool } from "@freeanima/legacy-clarify";
import { registerCronjobTool } from "./cronjob";
import { registerSkillsTools } from "./skills-tools";
import { registerTodoTool } from "./todo-tool";
import { registerBrowserTools } from "./browser";

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

export { registerFileTools } from "./file";
export { registerCredentialTools } from "./credential-tool";
