import { registerRunSimpleTurn } from "@freeanima/service-api/turn-lifecycle";
import { registerStatsReport } from "@freeanima/service-api/conversation-stats";
import { registerStudioPort } from "@freeanima/service-api/studio-port";
import { registerCronUseCases } from "@freeanima/service-api/cron-use-cases";
import { registerOnSessionCloseBeforeNew } from "@freeanima/service-api/session-close";
import { getToolSessionId } from "@freeanima/mechanism-tool";
import { registerToolSessionResolver } from "@freeanima/capabilities-memory/tool-session-port";
import { runSimpleTurn } from "./runtime/turn-lifecycle.ts";
import { statsReport } from "./runtime/conversation-stats.ts";
import { onSessionCloseBeforeNew } from "./runtime/use-cases/on-session-close.ts";
import { runCronEngineTurn } from "./runtime/use-cases/cron-runner.ts";
import {
  buildFileTree,
  getStudioConfig,
  patchStudioConfig,
  readStudioFile,
  resolveWorkspace,
  searchStudio,
} from "./runtime/studio.ts";
import type { FullRuntimeDeps } from "./runtime/runtime-deps.ts";

/** Register service-api ports after AppRuntime deps are available */
export function wireServicePorts(deps: FullRuntimeDeps): void {
  registerToolSessionResolver(getToolSessionId);
  registerOnSessionCloseBeforeNew((sessionId) => onSessionCloseBeforeNew(deps, sessionId));
  registerCronUseCases({
    runCronEngineTurn: (job, prompt) => runCronEngineTurn(deps, job, prompt),
  });
  registerRunSimpleTurn((opts) => runSimpleTurn(deps, opts));
  registerStatsReport((session, opts) => statsReport(deps, session, opts));
  registerStudioPort({
    getStudioConfig: () => getStudioConfig(deps),
    patchStudioConfig: (patch) => patchStudioConfig(deps, patch),
    buildFileTree: () => buildFileTree(deps),
    readStudioFile: (path) => readStudioFile(deps, path),
    searchStudio: (query) => searchStudio(deps, query),
    resolveWorkspace: () => resolveWorkspace(deps),
  });
}
