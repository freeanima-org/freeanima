import { registerClarifyTool } from "@freeanima/habitat/capabilities/tools/clarify";
import { registerContentBlockTools } from "@freeanima/features/content-block/domain";
import { registerDiaryTools } from "@freeanima/features/diary/domain";
import { registerCalendarTools } from "@freeanima/features/calendar/domain";
import { registerPomodoroTools } from "@freeanima/features/pomodoro/domain";
import { registerEmailTools } from "@freeanima/features/email/domain";
import { registerTaskTools } from "@freeanima/features/task/domain";
import { registerProjectTools } from "@freeanima/features/project/domain";
import { registerTagTools } from "@freeanima/features/tag/domain";
import { registerSubagentTools } from "@freeanima/features/subagent/domain";
import { registerVaultTools } from "@freeanima/features/vault/domain";
import {
  bindObjectStore,
  createObjectStore,
  registerObjectStorageTools,
} from "@freeanima/features/object-storage/domain";
import { registerNotificationTools } from "@freeanima/habitat/capabilities/tools/notification";
import {
  registerCoreTools,
  registerSupplementalTools,
} from "@freeanima/habitat/capabilities/tools";
import { registerCronjobTool } from "@freeanima/habitat/capabilities/connectors/cron/cronjob-tool";
import { registerSelfTools } from "@freeanima/habitat/capabilities/self";
import {
  assertEmailPasswordResolvable,
  deleteEmail,
  markAsRead,
  sendEmail,
} from "@freeanima/habitat/capabilities/connectors/email";
import type { Config } from "@freeanima/habitat/core/config";
import type { SkillRegistry } from "@freeanima/habitat/core/skill";
import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import { registerMemoryTools } from "@freeanima/habitat/capabilities/memory";
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
  registerSubagentTools(opts.toolSets);
  registerContentBlockTools(opts.toolSets);
  registerDiaryTools(opts.toolSets);
  registerCalendarTools(opts.toolSets);
  registerPomodoroTools(opts.toolSets);
  registerVaultTools(opts.toolSets);
  registerObjectStorageTools(opts.toolSets);
  registeredCatalog = opts;
}

/** Unit test reset */
export function resetRegisterServiceToolsForTest(): void {
  registeredCatalog = null;
}
