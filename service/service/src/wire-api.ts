import { registerRunSimpleTurn } from "@freeanima/service-api/turn-lifecycle";
import { registerStatsReport } from "@freeanima/service-api/conversation-stats";
import { runSimpleTurn } from "./runtime/turn-lifecycle.ts";
import { statsReport } from "./runtime/conversation-stats.ts";

registerRunSimpleTurn(runSimpleTurn);
registerStatsReport(statsReport);
