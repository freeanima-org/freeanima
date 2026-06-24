import { registerRunSimpleTurn } from "@freeanima/platform/ports/turn-lifecycle";
import { registerStatsReport } from "@freeanima/platform/ports/conversation-stats";
import { registerCronUseCases } from "@freeanima/platform/ports/cron-use-cases";
import { registerOnConversationCloseBeforeNew } from "@freeanima/platform/ports/conversation-close";
import { getToolConversationId } from "@freeanima/core/tool";
import { registerToolConversationResolver } from "@freeanima/capabilities-memory/tool-conversation-port";
import { runSimpleTurn } from "./runtime/turn-lifecycle.ts";
import { statsReport } from "./runtime/conversation-stats.ts";
import { onConversationCloseBeforeNew } from "./runtime/use-cases/on-conversation-close.ts";
import { runCronEngineTurn } from "./runtime/use-cases/cron-runner.ts";
import type { FullRuntimeDeps } from "./runtime/runtime-deps.ts";

/** Register platform API ports after AppRuntime deps are available */
export function wireServicePorts(deps: FullRuntimeDeps): void {
  registerToolConversationResolver(getToolConversationId);
  registerOnConversationCloseBeforeNew((conversationId) =>
    onConversationCloseBeforeNew(deps, conversationId),
  );
  registerCronUseCases({
    runCronEngineTurn: (job, prompt) => runCronEngineTurn(deps, job, prompt),
  });
  registerRunSimpleTurn((opts) => runSimpleTurn(deps, opts));
  registerStatsReport((conversation, opts) => statsReport(deps, conversation, opts));
}
