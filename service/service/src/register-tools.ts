import { registerClarifyTool } from "@freeanima/capabilities-clarify";
import { registerWriteFridgeMagnetTool } from "@freeanima/capabilities-fridge-magnet";
import { registerTaskTools } from "@freeanima/capabilities-tasks";
import { registerCoreTools, registerSupplementalTools } from "@freeanima/capabilities-tools";
import { registerCronjobTool } from "@freeanima/connectors-cron/cronjob-tool";
import { registerSelfTools } from "@freeanima/life-self";
import { bindEmailAccountsConfig, registerEstateTools } from "@freeanima/life-estate";
import type { Config } from "@freeanima/engine-config";
import type { SkillRegistry } from "@freeanima/engine-skill";
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { registerMemoryTools } from "@freeanima/life-memory";

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
  registerMemoryTools(opts.toolSets);
  registerSelfTools(opts.toolSets);
  registerEstateTools(opts.toolSets);
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
