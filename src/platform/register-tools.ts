import { registerClarifyTool } from "@freeanima/capabilities/tools/clarify";
import { registerDiaryTools } from "@freeanima/features/diary/domain";
import { registerEmailTools } from "@freeanima/features/email/domain";
import { registerTaskTools } from "@freeanima/features/task/domain";
import { registerVaultTools } from "@freeanima/features/vault/domain";
import { registerNotificationTools } from "@freeanima/capabilities/tools/notification";
import { registerCoreTools, registerSupplementalTools } from "@freeanima/capabilities/tools";
import { registerCronjobTool } from "@freeanima/platform/connectors/cron/cronjob-tool";
import { registerSelfTools } from "@freeanima/capabilities/identity";
import {
  assertEmailPasswordResolvable,
  deleteEmail,
  markAsRead,
  sendEmail,
} from "@freeanima/platform/connectors/email";
import {
  resolveAgentVaultSecret,
  resolveUserVaultSecret,
} from "@freeanima/platform/connectors/vault";
import type { Config } from "@freeanima/core/config";
import type { SkillRegistry } from "@freeanima/core/skill";
import type { ToolSetRegistry } from "@freeanima/core/tool";
import { registerMemoryTools } from "@freeanima/capabilities/memory";

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
  registerVaultTools(opts.toolSets, {
    resolveAgentSecret: async ({ worldId, itemId, field }) =>
      resolveAgentVaultSecret(worldId, itemId, field),
    resolveUserSecret: async ({ worldId, itemId, field, conversationId }) =>
      resolveUserVaultSecret({
        item_id: itemId,
        field,
        world_id: worldId,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
    injectEnv: ({ envName, value }) => {
      process.env[envName] = value;
    },
  });
  registeredCatalog = opts;
}

/** Unit test reset */
export function resetRegisterServiceToolsForTest(): void {
  registeredCatalog = null;
}
