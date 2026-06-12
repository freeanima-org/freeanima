import { registerClarifyTool } from "@freeanima/capabilities-tools/clarify";
import { registerWriteFridgeMagnetTool } from "@freeanima/capabilities-tasks/fridge-magnet";
import { registerTaskTools } from "@freeanima/capabilities-tasks";
import { registerCoreTools, registerSupplementalTools } from "@freeanima/capabilities-tools";
import { registerCronjobTool } from "@freeanima/platform/connectors/cron/cronjob-tool";
import { registerSelfTools } from "@freeanima/capabilities-identity";
import {
  bindEmailAccountsConfig,
  deleteEmail,
  deleteEmailAccount,
  editEmailAccount,
  fetchEmails,
  listEmailAccounts,
  listEmails,
  markAsRead,
  readEmail,
  registerEmailAccount,
  sendEmail,
} from "@freeanima/platform/connectors/email";
import { registerEstateTools } from "@freeanima/capabilities-tools/estate";
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
  bindEmailAccountsConfig(opts.config);
  const emailApi = {
    registerEmailAccount,
    editEmailAccount,
    listEmailAccounts,
    deleteEmailAccount,
    sendEmail,
    fetchEmails,
    listEmails,
    readEmail,
    markAsRead,
    deleteEmail,
  };
  registerMemoryTools(opts.toolSets);
  registerSelfTools(opts.toolSets);
  registerEstateTools(opts.toolSets, emailApi);
  registerClarifyTool(opts.toolSets);
  registerCronjobTool(opts.toolSets);
  registerWriteFridgeMagnetTool(opts.toolSets);
  registerTaskTools(opts.toolSets);
  registeredCatalog = opts;
}

/** Unit test reset */
export function resetRegisterServiceToolsForTest(): void {
  registeredCatalog = null;
}
