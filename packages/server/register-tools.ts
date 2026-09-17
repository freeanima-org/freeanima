import { registerClarifyTool } from "@freeanima/capabilities/tools/clarify";
import { registerContentBlockTools } from "@freeanima/features/content-block/domain";
import { registerPomodoroTools } from "@freeanima/features/pomodoro/domain";
import { registerEmailTools } from "@freeanima/features/email/domain";
import { registerTaskTools } from "@freeanima/features/task/domain";
import { registerSubagentTools } from "@freeanima/features/subagent/domain";
import { registerWorkflowTools } from "@freeanima/features/workflow/domain";
import { registerVaultTools } from "@freeanima/features/vault/domain";
import { registerContactTools } from "@freeanima/features/contact/domain";
import { registerHabitTools } from "@freeanima/features/habit/domain";
import {
  bindObjectStore,
  createObjectStore,
  registerObjectStorageTools,
} from "@freeanima/features/object-storage/domain";
import { registerNotificationTools } from "@freeanima/capabilities/tools/notification";
import { registerCoreTools, registerSupplementalTools } from "@freeanima/capabilities/tools";
import { registerMediaTools } from "@freeanima/capabilities/tools/media/tools";
import { registerCronjobTool } from "@freeanima/capabilities/connectors/cron/cronjob-tool";
import { registerSelfTools } from "@freeanima/capabilities/self";
import {
  assertEmailPasswordResolvable,
  deleteEmail,
  markAsRead,
  sendEmail,
} from "@freeanima/capabilities/connectors/email";
import type { Config } from "@freeanima/core/config";
import type { SkillRegistry } from "@freeanima/core/skill";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { registerMemoryTools } from "@freeanima/capabilities/memory";
import { registerOpsTools } from "./service/ops-tools.ts";
import { registerEntityAndTagTools } from "./register-entity-tools.ts";

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
  bindObjectStore(createObjectStore(opts.config.data.object_storage ?? {}));
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
  registerOpsTools(opts.toolSets);
  registerNotificationTools(opts.toolSets);
  registerTaskTools(opts.toolSets);
  registerEntityAndTagTools(opts.toolSets);
  registerSubagentTools(opts.toolSets);
  registerWorkflowTools(opts.toolSets);
  registerContentBlockTools(opts.toolSets);
  registerPomodoroTools(opts.toolSets);
  registerVaultTools(opts.toolSets);
  registerObjectStorageTools(opts.toolSets);
  registerMediaTools(opts.toolSets);
  registerContactTools(opts.toolSets);
  registerHabitTools(opts.toolSets);
  registeredCatalog = opts;
}

/** Unit test reset */
export function resetRegisterServiceToolsForTest(): void {
  registeredCatalog = null;
}
