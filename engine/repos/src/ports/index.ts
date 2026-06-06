import type { SessionStorePort } from "./session.ts";

export type { SessionStorePort, SessionSummaryRow } from "./session.ts";
export type { MemoryStorePort } from "./memory.ts";
export type { CronJobStorePort } from "./cron.ts";
export type { TaskStorePort } from "./task.ts";

/** Engine 挂载的 PG 仓储聚合 */
export interface PgRepositories {
  readonly pgAvailable: boolean;
  session: SessionStorePort;
}
