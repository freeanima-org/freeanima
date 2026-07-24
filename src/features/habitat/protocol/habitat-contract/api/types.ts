/** Habitat 协议响应类型：与 service 内部快照 / 展示视图对齐 */

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
} from "@freeanima/host/core/db/schema/rows";
export type { EntityRow } from "@freeanima/host/core/db/pg/entity/types";

export type {
  DependencyStatus,
  HealthSnapshot as HealthResponse,
  PlatformStatusSnapshot as PlatformStatus,
  SafeConfigSnapshot as SafeConfigResponse,
  ServiceSnapshot as ServiceStatus,
  ConversationSummary as ConversationListItem,
} from "@freeanima/shared/rpc-contract/frames/snapshot.ts";

export type { SelfBlockDisplay } from "../self-block-display.ts";

export type { CronJobData as CronJobApi } from "@freeanima/host/capabilities/connectors/cron";

export type CronJobsResponse = {
  jobs: import("@freeanima/host/capabilities/connectors/cron").CronJobData[];
};
