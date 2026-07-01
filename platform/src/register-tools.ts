import { registerClarifyTool } from "@freeanima/capabilities-tools/clarify";
import { registerDiaryTools } from "@freeanima/capabilities-diary";
import { registerEmailTools } from "@freeanima/capabilities-email";
import { registerTaskTools } from "@freeanima/capabilities-task";
import { registerNotificationTools } from "@freeanima/capabilities-tools/notification";
import { registerCoreTools, registerSupplementalTools } from "@freeanima/capabilities-tools";
import { registerCronjobTool } from "@freeanima/platform/connectors/cron/cronjob-tool";
import { registerSelfTools } from "@freeanima/capabilities-identity";
import {
  assertEmailPasswordResolvable,
  deleteEmail,
  markAsRead,
  sendEmail,
} from "@freeanima/platform/connectors/email";
import type { Config } from "@freeanima/core/config";
import type { SkillRegistry } from "@freeanima/core/skill";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { registerMemoryTools } from "@freeanima/capabilities-memory";

let registeredCatalog: { toolSets: ToolSetRegistry; skills: SkillRegistry } | null = null;

/** Register all local/non-MCP tools (idempotent: register once per catalog instance) */
export function registerServiceTools(opts: {
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
  config: Config;
}): void {
  if (registeredCatalog?.toolSets === opts.toolSets && registeredCatalog?.skills === opts.skills) {
    return;
  }
  registerCoreTools(opts.toolSets, opts.config);
  registerSupplementalTools(opts.toolSets, opts.skills, opts.config);
  registerMemoryTools(opts.toolSets);
  registerSelfTools(opts.toolSets);
  registerEmailTools(opts.toolSets, {
    sendEmail,
    markAsRead,
    deleteEmail,
    assertPasswordResolvable: assertEmailPasswordResolvable,
  });
  registerClarifyTool(opts.toolSets);
  registerCronjobTool(opts.toolSets);
  registerNotificationTools(opts.toolSets);
  registerTaskTools(opts.toolSets);
  registerDiaryTools(opts.toolSets);
  registeredCatalog = opts;
}

/** Unit test reset */
export function resetRegisterServiceToolsForTest(): void {
  registeredCatalog = null;
}
