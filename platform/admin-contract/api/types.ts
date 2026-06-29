/** Admin wire 响应类型：与 service 内部快照 / 展示视图对齐 */

export type {
  DisplayItem,
  DisplayMessageItem,
  DisplayToolBlockItem,
  DisplayToolCall,
  MessagesDisplay as MessagesResponse,
} from "@freeanima/platform/ports/schemas/display";

export type {
  AutobiographicalMemoryRow,
  DreamMemoryRow,
  EntityRow,
  LimbicMemoryRow,
  SemanticMemoryRow,
} from "@freeanima/core/repos";

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
