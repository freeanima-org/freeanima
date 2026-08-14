import type { PipelineDefinition } from "@freeanima/habitat/engine/pipeline";

import { shouldSkipScheduledDeepSleep } from "./deep-sleep-mode.ts";

/** 记忆维护 pipeline id（原 sleep-cycle） */
export const MEMORY_MAINTENANCE_PIPELINE_ID = "memory-maintenance";

/** @deprecated 历史 pipeline_step_run / catch-up 仍可能读到旧 id */
export const SLEEP_CYCLE_PIPELINE_ID = MEMORY_MAINTENANCE_PIPELINE_ID;

/** 记忆维护 DAG 节点 id */
export const MAINTENANCE_STEP_IDS = {
  conversationCleanup: "conversation-cleanup",
  retainCatchUp: "retain-catch-up",
  reflect: "reflect",
  selfLayerRefresh: "self-layer-refresh",
  temporalSummaryDay: "temporal-summary-day",
  temporalSummaryCascade: "temporal-summary-cascade",
} as const;

/** @deprecated 兼容旧符号名 */
export const SLEEP_STEP_IDS = {
  conversationCleanup: MAINTENANCE_STEP_IDS.conversationCleanup,
  lightSleep: MAINTENANCE_STEP_IDS.retainCatchUp,
  deepSleep: MAINTENANCE_STEP_IDS.reflect,
  memoryRefSync: "memory-ref-sync-removed",
  selfLayerRefresh: MAINTENANCE_STEP_IDS.selfLayerRefresh,
  temporalSummaryDay: MAINTENANCE_STEP_IDS.temporalSummaryDay,
  temporalSummaryCascade: MAINTENANCE_STEP_IDS.temporalSummaryCascade,
} as const;

/**
 * 记忆维护 DAG：cleanup + retain 补跑 + reflect + temporal + self-refresh。
 * 不再含 light/deep sleep 或 memory-ref-sync（热路径已 bump reference_count）。
 */
export const memoryMaintenanceDefinition: PipelineDefinition = {
  id: MEMORY_MAINTENANCE_PIPELINE_ID,
  nodes: [
    {
      id: MAINTENANCE_STEP_IDS.conversationCleanup,
      handler: MAINTENANCE_STEP_IDS.conversationCleanup,
    },
    {
      id: MAINTENANCE_STEP_IDS.retainCatchUp,
      handler: MAINTENANCE_STEP_IDS.retainCatchUp,
      dependsOn: [MAINTENANCE_STEP_IDS.conversationCleanup],
    },
    {
      id: MAINTENANCE_STEP_IDS.reflect,
      handler: MAINTENANCE_STEP_IDS.reflect,
      dependsOn: [MAINTENANCE_STEP_IDS.retainCatchUp],
      skipIf: shouldSkipScheduledDeepSleep,
    },
    {
      id: MAINTENANCE_STEP_IDS.temporalSummaryDay,
      handler: MAINTENANCE_STEP_IDS.temporalSummaryDay,
      dependsOn: [MAINTENANCE_STEP_IDS.retainCatchUp],
      optional: true,
    },
    {
      id: MAINTENANCE_STEP_IDS.temporalSummaryCascade,
      handler: MAINTENANCE_STEP_IDS.temporalSummaryCascade,
      dependsOn: [MAINTENANCE_STEP_IDS.temporalSummaryDay],
      optional: true,
    },
    {
      id: MAINTENANCE_STEP_IDS.selfLayerRefresh,
      handler: MAINTENANCE_STEP_IDS.selfLayerRefresh,
      dependsOn: [MAINTENANCE_STEP_IDS.reflect],
      skipIf: shouldSkipScheduledDeepSleep,
      optional: true,
    },
  ],
};

/** @deprecated */
export const sleepCycleDefinition = memoryMaintenanceDefinition;
