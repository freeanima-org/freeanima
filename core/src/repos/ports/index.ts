import type { MemoryReferenceStorePort } from "./memory-reference.ts";
import type { SemanticMemoryStorePort } from "./semantic-memory.ts";
import type { SessionStorePort } from "./session.ts";

export type {
  SessionStorePort,
  SessionSummaryRow,
  SessionCleanupResult,
  MessageFtsHit,
  MessageRowView,
} from "./session.ts";
export { RESIDENT_PINNED_MAX, RESIDENT_TOP_N } from "./semantic-memory.ts";
export type {
  SemanticMemoryRow,
  SemanticFtsHit,
  SemanticMemoryCreateInput,
  SemanticMemoryUpdateInput,
  SemanticMemorySearchOpts,
  SemanticMemorySortBy,
  SemanticMemoryStorePort,
} from "./semantic-memory.ts";
export type {
  CronJobRow,
  CronJobCreateInput,
  CronJobBuiltinUpsertInput,
  CronJobUpdateInput,
  CronJobStorePort,
} from "./cron.ts";
export type {
  CronLogRow,
  CronLogAppendInput,
  CronLogListOpts,
  CronLogStorePort,
} from "./cron-log.ts";
export type {
  PipelineStepRunRow,
  PipelineStepRunAppendInput,
  PipelineStepRunListOpts,
  PipelineStepRunStorePort,
} from "./pipeline-step-run.ts";
export type {
  AutoLlmRunRow,
  AutoLlmRunAppendInput,
  PurgeStaleAutoLlmRunsOpts,
  AutoLlmRunListOpts,
  AutoLlmRunCountOpts,
  AutoLlmRunStorePort,
} from "./auto-llm-run.ts";
export type {
  TaskStorePort,
  TaskRow,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListOpts,
  TaskStatus,
  TaskPriority,
} from "./task.ts";
export { TASK_STATUSES, TASK_PRIORITIES } from "./task.ts";
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
  AutobiographicalListOpts,
  AutobiographicalFtsHit,
  AutobiographicalMemoryStorePort,
} from "./autobiographical-memory.ts";
export type {
  MemoryReferenceRow,
  MemoryReferenceStorePort,
  RecordMessageReferencesInput,
} from "./memory-reference.ts";
export type {
  LimbicKind,
  LimbicMemoryRow,
  LimbicMemoryCreateInput,
  LimbicListOpts,
  LimbicListBySessionsOpts,
  LimbicFtsHit,
  LimbicMemoryStorePort,
} from "./limbic-memory.ts";
export type {
  DreamEpisodicSnippet,
  DreamMemoryRow,
  DreamMemoryCreateInput,
  DreamMemoryStorePort,
} from "./dream-memory.ts";
export type {
  SapInstanceRow,
  SapInstanceUpsertInput,
  SapInstanceStorePort,
} from "./sap-instance.ts";

import type { AutoLlmRunStorePort } from "./auto-llm-run.ts";
import type { AutobiographicalMemoryStorePort } from "./autobiographical-memory.ts";
import type { CronJobStorePort } from "./cron.ts";
import type { CronLogStorePort } from "./cron-log.ts";
import type { PipelineStepRunStorePort } from "./pipeline-step-run.ts";
import type { DreamMemoryStorePort } from "./dream-memory.ts";
import type { LimbicMemoryStorePort } from "./limbic-memory.ts";
import type { SelfLayerStorePort } from "./self-layer.ts";
import type { SapInstanceStorePort } from "./sap-instance.ts";
import type { TaskStorePort } from "./task.ts";

/** PG repository aggregate mounted on Engine */
export interface PgRepositories {
  readonly pgAvailable: boolean;
  session: SessionStorePort;
  semanticMemory: SemanticMemoryStorePort;
  memoryReference: MemoryReferenceStorePort;
  selfLayer: SelfLayerStorePort;
  autobiographicalMemory: AutobiographicalMemoryStorePort;
  limbicMemory: LimbicMemoryStorePort;
  dreamMemory: DreamMemoryStorePort;
  cron: CronJobStorePort;
  cronLog: CronLogStorePort;
  pipelineStepRun: PipelineStepRunStorePort;
  autoLlmRun: AutoLlmRunStorePort;
  tasks: TaskStorePort;
  sapInstance: SapInstanceStorePort;
}
