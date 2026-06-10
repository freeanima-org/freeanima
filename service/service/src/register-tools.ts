import { registerClarifyTool } from "@freeanima/capabilities-clarify";
import { registerWriteFridgeMagnetTool } from "@freeanima/capabilities-fridge-magnet";
import { registerTaskTools } from "@freeanima/capabilities-tasks";
import { registerCoreTools, registerSupplementalTools } from "@freeanima/capabilities-tools";
import { registerCronjobTool } from "@freeanima/connectors-cron/cronjob-tool";
import { registerSelfTools } from "@freeanima/life-self";
import { registerEstateTools } from "@freeanima/life-estate";
import type { SkillRegistry } from "@freeanima/engine-skill";
import type { ToolSetRegistry } from "@freeanima/engine-tool";
import { registerMemoryTools } from "@freeanima/life-memory";

let registeredCatalog: { toolSets: ToolSetRegistry; skills: SkillRegistry } | null = null;

/** 注册全部本地/MCP 无关工具（幂等：同一 catalog 实例只注册一次） */
export function registerServiceTools(opts: {
  toolSets: ToolSetRegistry;
  skills: SkillRegistry;
}): void {
  if (registeredCatalog?.toolSets === opts.toolSets && registeredCatalog?.skills === opts.skills) {
    return;
  }
  registerCoreTools(opts.toolSets);
  registerSupplementalTools(opts.toolSets, opts.skills);
  registerMemoryTools(opts.toolSets);
  registerSelfTools(opts.toolSets);
  registerEstateTools(opts.toolSets);
  registerClarifyTool(opts.toolSets);
  registerCronjobTool(opts.toolSets);
  registerWriteFridgeMagnetTool(opts.toolSets);
  registerTaskTools(opts.toolSets);
  registeredCatalog = opts;
}

/** 单测 reset */
export function resetRegisterServiceToolsForTest(): void {
  registeredCatalog = null;
}
