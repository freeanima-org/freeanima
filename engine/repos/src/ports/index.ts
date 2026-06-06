import type { SemanticMemoryStorePort } from "./semantic-memory.ts";
import type { SessionStorePort } from "./session.ts";

export type { SessionStorePort, SessionSummaryRow, MessageFtsHit } from "./session.ts";
export type {
  SemanticMemoryRow,
  SemanticFtsHit,
  SemanticMemoryStorePort,
} from "./semantic-memory.ts";
export type { CronJobStorePort } from "./cron.ts";
export type { TaskStorePort } from "./task.ts";

/** Engine 挂载的 PG 仓储聚合 */
export interface PgRepositories {
  readonly pgAvailable: boolean;
  session: SessionStorePort;
  semanticMemory: SemanticMemoryStorePort;
}
