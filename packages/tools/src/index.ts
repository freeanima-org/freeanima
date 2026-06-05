import { registerCoreTools } from "@freeanima/capabilities-tools";
import { registerClarifyTool } from "@freeanima/capabilities-clarify";
import { registerMemoryTools } from "@freeanima/life-memory";
import { registerBrowserTools } from "./browser.ts";
import { registerCronjobTool } from "./cronjob.ts";
import { registerSkillsTools } from "./skills-tools.ts";
import { registerTodoTool } from "./todo-tool.ts";

let registered = false;

export function registerAllTools(): void {
  if (registered) return;
  registerCoreTools();
  registerMemoryTools();
  registerBrowserTools();
  registerClarifyTool();
  registerCronjobTool();
  registerSkillsTools();
  registerTodoTool();
  registered = true;
}

export {
  registerCoreTools,
  registerFileTools,
  registerCredentialTools,
  registerExecuteCodeTool,
  registerTerminalTools,
  registerWebTools,
} from "@freeanima/capabilities-tools";
