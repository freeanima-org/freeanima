import { registerRunSimpleTurn } from "@freeanima/service-api/turn-lifecycle";
import { registerStatsReport } from "@freeanima/service-api/conversation-stats";
import { registerStudioPort } from "@freeanima/service-api/studio-port";
import { runSimpleTurn } from "./runtime/turn-lifecycle.ts";
import { statsReport } from "./runtime/conversation-stats.ts";
import {
  buildFileTree,
  getStudioConfig,
  patchStudioConfig,
  readStudioFile,
  resolveWorkspace,
  searchStudio,
} from "./runtime/studio.ts";

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
