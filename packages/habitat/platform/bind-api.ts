import { registerRunSimpleTurn } from "@freeanima/habitat/platform/ports/turn-lifecycle";
import { registerStatsReport } from "@freeanima/habitat/platform/ports/conversation-stats";
import { registerCronUseCases } from "@freeanima/habitat/platform/ports/cron-use-cases";
import {
  formatCronNotificationText,
  formatInprocessBuiltinFailureText,
  registerCronNotify,
  registerInprocessBuiltinFailureNotify,
} from "@freeanima/habitat/platform/ports/cron-notify";
import { registerOnConversationCloseBeforeNew } from "@freeanima/habitat/platform/ports/conversation-close";
import { getToolConversationId } from "@freeanima/habitat/core/tool";
import { registerToolConversationResolver } from "@freeanima/habitat/capabilities/memory/tool-conversation-port";
import { runSimpleTurn } from "./service/turn-lifecycle.ts";
import { statsReport } from "./service/conversation-stats.ts";
import { onConversationCloseBeforeNew } from "./service/use-cases/on-conversation-close.ts";
import { runCronEngineTurn } from "./service/use-cases/cron-runner.ts";
import { registerSoftFailureNotify } from "@freeanima/habitat/core/soft-failure";
import { notifyBothRecipients } from "./service/notification-helpers.ts";
import { deliverSoftFailureNotify } from "./service/soft-failure-notify.ts";
import type { FullRuntimeDeps } from "./service/runtime-deps.ts";
import type { CronJob } from "@freeanima/habitat/capabilities/connectors/cron/models";

/** Register platform API ports after AppRuntime deps are available */
export function bindServicePorts(deps: FullRuntimeDeps): void {
  registerSoftFailureNotify(deliverSoftFailureNotify);
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
  registerInprocessBuiltinFailureNotify(async (payload) => {
    const { title, body } = formatInprocessBuiltinFailureText(payload);
    await notifyBothRecipients(deps, deps.engine.config, {
      title,
      body,
      source_kind: "system",
      source_ref: `inprocess:${payload.id}:${payload.run_count}:fail`,
    });
  });
  registerRunSimpleTurn((opts) => runSimpleTurn(deps, opts));
  registerStatsReport((conversation, opts) => statsReport(deps, conversation, opts));
}
