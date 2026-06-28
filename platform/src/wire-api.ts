import { registerRunSimpleTurn } from "@freeanima/platform/ports/turn-lifecycle";
import { registerStatsReport } from "@freeanima/platform/ports/conversation-stats";
import { registerCronUseCases } from "@freeanima/platform/ports/cron-use-cases";
import {
  formatCronNotificationText,
  registerCronNotify,
} from "@freeanima/platform/ports/cron-notify";
import { registerOnConversationCloseBeforeNew } from "@freeanima/platform/ports/conversation-close";
import { getToolConversationId } from "@freeanima/core/tool";
import { registerToolConversationResolver } from "@freeanima/capabilities-memory/tool-conversation-port";
import { runSimpleTurn } from "./runtime/turn-lifecycle.ts";
import { statsReport } from "./runtime/conversation-stats.ts";
import { onConversationCloseBeforeNew } from "./runtime/use-cases/on-conversation-close.ts";
import { runCronEngineTurn } from "./runtime/use-cases/cron-runner.ts";
import { notifyBothRecipients } from "./runtime/notification-helpers.ts";
import type { FullRuntimeDeps } from "./runtime/runtime-deps.ts";
import type { CronJob } from "@freeanima/platform/connectors/cron/models";

/** Register platform API ports after AppRuntime deps are available */
export function wireServicePorts(deps: FullRuntimeDeps): void {
  registerToolConversationResolver(getToolConversationId);
  registerOnConversationCloseBeforeNew((conversationId) =>
    onConversationCloseBeforeNew(deps, conversationId),
  );
  registerCronUseCases({
    runCronEngineTurn: (job, prompt) => runCronEngineTurn(deps, job, prompt),
  });
  registerCronNotify(async (job: CronJob, payload) => {
    const { title, body } = formatCronNotificationText(job, payload);
    await notifyBothRecipients(deps, deps.engine.config, {
      title,
      body,
      source_kind: "cron",
      source_ref: `${job.id}:${job.run_count}:${payload.success ? "ok" : "fail"}`,
    });
  });
  registerRunSimpleTurn((opts) => runSimpleTurn(deps, opts));
  registerStatsReport((conversation, opts) => statsReport(deps, conversation, opts));
}
