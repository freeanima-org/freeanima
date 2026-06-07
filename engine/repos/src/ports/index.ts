import type { SemanticMemoryStorePort } from "./semantic-memory.ts";
import type { SessionStorePort } from "./session.ts";

export type { SessionStorePort, SessionSummaryRow, MessageFtsHit } from "./session.ts";
export type {
  SemanticMemoryRow,
  SemanticFtsHit,
  SemanticMemoryCreateInput,
  SemanticMemoryUpdateInput,
  SemanticMemorySearchOpts,
  SemanticMemoryStorePort,
} from "./semantic-memory.ts";
export type {
  CronJobRow,
  CronJobCreateInput,
  CronJobBuiltinUpsertInput,
  CronJobUpdateInput,
  CronJobStorePort,
} from "./cron.ts";
export type { TaskStorePort } from "./task.ts";
export type {
  SelfBlockKey,
  SelfBlockRow,
  SelfBlockUpsertInput,
  SelfBlockUpdateInput,
  SelfLayerStorePort,
} from "./self-layer.ts";
export { SELF_BLOCK_KEYS } from "./self-layer.ts";
export type {
  AutobiographicalSignificance,
  AutobiographicalStatus,
  AutobiographicalMemoryRow,
  AutobiographicalMemoryCreateInput,
  AutobiographicalListOrder,
  AutobiographicalMemoryStorePort,
} from "./autobiographical-memory.ts";
export type {
  LimbicKind,
  LimbicMemoryRow,
  LimbicMemoryCreateInput,
  LimbicMemoryStorePort,
} from "./limbic-memory.ts";

import type { AutobiographicalMemoryStorePort } from "./autobiographical-memory.ts";
import type { CronJobStorePort } from "./cron.ts";
import type { LimbicMemoryStorePort } from "./limbic-memory.ts";
import type { SelfLayerStorePort } from "./self-layer.ts";

/** Engine 挂载的 PG 仓储聚合 */
export interface PgRepositories {
  readonly pgAvailable: boolean;
  session: SessionStorePort;
  semanticMemory: SemanticMemoryStorePort;
  selfLayer: SelfLayerStorePort;
  autobiographicalMemory: AutobiographicalMemoryStorePort;
  limbicMemory: LimbicMemoryStorePort;
  cron: CronJobStorePort;
}
