/** WebUI wire 响应类型：与 kernel-schemas 内部快照对齐 */

export type {
  DisplayItem,
  DisplayMessageItem,
  DisplayToolBlockItem,
  DisplayToolCall,
  HealthSnapshot as HealthResponse,
  MessagesDisplay as MessagesResponse,
  PlatformStatusSnapshot as PlatformStatus,
  SafeConfigSnapshot as SafeConfigResponse,
  ServiceSnapshot as ServiceStatus,
  SessionSummary as SessionListItem,
} from "@freeanima/kernel-schemas";

export type { CronJobData as CronJobApi } from "@freeanima/kernel-schemas";

export type CronJobsResponse = {
  jobs: import("@freeanima/kernel-schemas").CronJobData[];
};
