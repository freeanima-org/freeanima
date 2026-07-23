/** Habitat API protocol types — canonical imports (no console-contract barrel). */

export type {
  DisplayItem,
  DisplayMessageItem,
  DisplayToolBlockItem,
  DisplayToolCall,
  MessagesDisplay as MessagesResponse,
} from "@freeanima/platform/ports/schemas/display";

export type {
  AutobiographicalMemoryRow,
  LimbicMemoryRow,
  SemanticMemoryRow,
} from "@freeanima/core/db/schema/rows";
export type { EntityRow } from "@freeanima/core/db/pg/entity/types";

export type {
  DependencyStatus,
  HealthSnapshot as HealthResponse,
  PlatformStatusSnapshot as PlatformStatus,
  SafeConfigSnapshot as SafeConfigResponse,
  ServiceSnapshot as ServiceStatus,
  ConversationSummary as ConversationListItem,
} from "@freeanima/platform/ports/schemas/snapshot";

export type { SelfBlockDisplay } from "@freeanima/platform/runtime/service-self";

export type { CronJobData as CronJobApi } from "@freeanima/platform/connectors/cron";

export type CronJobsResponse = {
  jobs: import("@freeanima/platform/connectors/cron").CronJobData[];
};
