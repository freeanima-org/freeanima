/** Habitat API protocol types — canonical imports (no console-contract barrel). */

export type {
  DisplayItem,
  DisplayMessageItem,
  DisplayToolBlockItem,
  DisplayToolCall,
  MessagesDisplay as MessagesResponse,
} from "@freeanima/shared/rpc-contract/frames/display.ts";

export type {
  AutobiographicalMemoryRow,
  LimbicMemoryRow,
  SemanticMemoryRow,
} from "@freeanima/shared/pg-shapes/rows/memory-rows.ts";
export type { EntityRow } from "@freeanima/shared/pg-shapes/rows/entity-row.ts";

export type {
  DependencyStatus,
  HealthSnapshot as HealthResponse,
  PlatformStatusSnapshot as PlatformStatus,
  SafeConfigSnapshot as SafeConfigResponse,
  ServiceSnapshot as ServiceStatus,
  ConversationSummary as ConversationListItem,
} from "@freeanima/shared/rpc-contract/frames/snapshot.ts";

export type { SelfBlockDisplay } from "@freeanima/features/habitat/protocol/habitat-contract/self-block-display.ts";

export type { CronJobData as CronJobApi } from "@freeanima/habitat/capabilities/connectors/cron";

export type CronJobsResponse = {
  jobs: import("@freeanima/habitat/capabilities/connectors/cron").CronJobData[];
};
