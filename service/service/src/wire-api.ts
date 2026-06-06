import { registerRunSimpleTurn } from "@freeanima/service-api/turn-lifecycle";
import { registerStatsReport } from "@freeanima/service-api/conversation-stats";
import { registerStudioPort } from "@freeanima/service-api/studio-port";
import { registerCronUseCases } from "@freeanima/service-api/cron-use-cases";
import { registerOnSessionCloseBeforeNew } from "@freeanima/service-api/session-close";
import { registerLlmStackConfigurator } from "@freeanima/engine-llm";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-provider-openai-compatible";
import { runSimpleTurn } from "./runtime/turn-lifecycle.ts";
import { statsReport } from "./runtime/conversation-stats.ts";
import { onSessionCloseBeforeNew } from "./runtime/use-cases/on-session-close.ts";
import { runCronEngineTurn, runCronL2GapFill } from "./runtime/use-cases/cron-runner.ts";
import {
  buildFileTree,
  getStudioConfig,
  patchStudioConfig,
  readStudioFile,
  resolveWorkspace,
  searchStudio,
} from "./runtime/studio.ts";

registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
registerOnSessionCloseBeforeNew(onSessionCloseBeforeNew);
registerCronUseCases({ runCronL2GapFill, runCronEngineTurn });
registerRunSimpleTurn(runSimpleTurn);
registerStatsReport(statsReport);
registerStudioPort({
  getStudioConfig,
  patchStudioConfig,
  buildFileTree,
  readStudioFile,
  searchStudio,
  resolveWorkspace,
});
