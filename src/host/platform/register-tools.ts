import { registerClarifyTool } from "@freeanima/host/capabilities/tools/clarify";
import { registerContentBlockTools } from "@freeanima/features/content-block/domain";
import { registerDiaryTools } from "@freeanima/features/diary/domain";
import { registerPomodoroTools } from "@freeanima/features/pomodoro/domain";
import { registerEmailTools } from "@freeanima/features/email/domain";
import { registerTaskTools } from "@freeanima/features/task/domain";
import { registerProjectTools } from "@freeanima/features/project/domain";
import { registerTagTools } from "@freeanima/features/tag/domain";
import { registerVaultTools } from "@freeanima/features/vault/domain";
import {
  bindObjectStore,
  createObjectStore,
  registerObjectStorageTools,
} from "@freeanima/features/object-storage/domain";
import { registerNotificationTools } from "@freeanima/host/capabilities/tools/notification";
import { registerCoreTools, registerSupplementalTools } from "@freeanima/host/capabilities/tools";
import { registerCronjobTool } from "@freeanima/host/capabilities/connectors/cron/cronjob-tool";
import { registerSelfTools } from "@freeanima/host/capabilities/self";
import {
  assertEmailPasswordResolvable,
  deleteEmail,
  markAsRead,
  sendEmail,
} from "@freeanima/host/capabilities/connectors/email";
import type { Config } from "@freeanima/host/core/config";
import type { SkillRegistry } from "@freeanima/host/core/skill";
import type { ToolSetRegistry } from "@freeanima/host/core/tool";
import { registerMemoryTools } from "@freeanima/host/capabilities/memory";
import { registerOpsTools } from "./service/ops-tools.ts";

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
  registerProjectTools(opts.toolSets);
  registerTagTools(opts.toolSets);
  registerContentBlockTools(opts.toolSets);
  registerDiaryTools(opts.toolSets);
  registerPomodoroTools(opts.toolSets);
  registerVaultTools(opts.toolSets);
  registerObjectStorageTools(opts.toolSets);
  registeredCatalog = opts;
}

/** Unit test reset */
export function resetRegisterServiceToolsForTest(): void {
  registeredCatalog = null;
}
