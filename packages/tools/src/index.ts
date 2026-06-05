import { registerCoreTools, registerSupplementalTools } from "@freeanima/capabilities-tools";
import { registerClarifyTool } from "@freeanima/capabilities-clarify";
import { registerCronjobTool } from "@freeanima/connectors-cron/cronjob-tool";
import { registerMemoryTools } from "@freeanima/life-memory";

let registered = false;

export function registerAllTools(): void {
  if (registered) return;
  registerCoreTools();
  registerSupplementalTools();
  registerMemoryTools();
  registerClarifyTool();
  registerCronjobTool();
  registered = true;
}

export {
  registerCoreTools,
  registerSupplementalTools,
  registerBrowserTools,
  registerSkillsTools,
  registerTodoTool,
  registerFileTools,
  registerCredentialTools,
  registerExecuteCodeTool,
  registerTerminalTools,
  registerWebTools,
} from "@freeanima/capabilities-tools";

export { registerCronjobTool } from "@freeanima/connectors-cron/cronjob-tool";
