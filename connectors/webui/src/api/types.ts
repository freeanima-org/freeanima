/** WebUI wire 响应类型：与 service 内部快照 / 展示视图对齐 */

export type {
  DisplayItem,
  DisplayMessageItem,
  DisplayToolBlockItem,
  DisplayToolCall,
  MessagesDisplay as MessagesResponse,
} from "@freeanima/service-api/schemas/display";

export type { PromptDebugResponse, ToolsStatusResponse, ToolsStatusToolItem } from "./schemas.ts";

export type {
  DependencyStatus,
  HealthSnapshot as HealthResponse,
  PlatformStatusSnapshot as PlatformStatus,
  SafeConfigSnapshot as SafeConfigResponse,
  ServiceSnapshot as ServiceStatus,
  SessionSummary as SessionListItem,
} from "@freeanima/service-api/schemas/snapshot";

export type { CronJobData as CronJobApi } from "@freeanima/connectors-cron";

export type CronJobsResponse = {
  jobs: import("@freeanima/connectors-cron").CronJobData[];
};
