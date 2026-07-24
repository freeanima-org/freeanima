import type { PipelineDefinition } from "@freeanima/host/engine/pipeline";

/** 睡眠周期 pipeline id */
export const SLEEP_CYCLE_PIPELINE_ID = "sleep-cycle";

/** 睡眠 DAG 节点 id */
export const SLEEP_STEP_IDS = {
  conversationCleanup: "conversation-cleanup",
  lightSleep: "light-sleep",
  deepSleep: "deep-sleep",
  dream: "dream",
  memoryRefSync: "memory-ref-sync",
  selfLayerRefresh: "self-layer-refresh",
  temporalSummaryDay: "temporal-summary-day",
  temporalSummaryCascade: "temporal-summary-cascade",
} as const;

/**
 * 睡眠周期 DAG（宏观层）。
 * 浅睡/深睡内部多阶段仍由各自 run* 函数顺序编排，不提升到本 DAG。
 */
export const sleepCycleDefinition: PipelineDefinition = {
  id: SLEEP_CYCLE_PIPELINE_ID,
  nodes: [
    {
      id: SLEEP_STEP_IDS.conversationCleanup,
      handler: SLEEP_STEP_IDS.conversationCleanup,
    },
    {
      id: SLEEP_STEP_IDS.lightSleep,
      handler: SLEEP_STEP_IDS.lightSleep,
      dependsOn: [SLEEP_STEP_IDS.conversationCleanup],
    },
    {
      id: SLEEP_STEP_IDS.deepSleep,
      handler: SLEEP_STEP_IDS.deepSleep,
      dependsOn: [SLEEP_STEP_IDS.lightSleep],
    },
    {
      id: SLEEP_STEP_IDS.dream,
      handler: SLEEP_STEP_IDS.dream,
      dependsOn: [SLEEP_STEP_IDS.lightSleep],
      optional: true,
    },
    {
      id: SLEEP_STEP_IDS.selfLayerRefresh,
      handler: SLEEP_STEP_IDS.selfLayerRefresh,
      dependsOn: [SLEEP_STEP_IDS.lightSleep],
      optional: true,
    },
    {
      id: SLEEP_STEP_IDS.temporalSummaryDay,
      handler: SLEEP_STEP_IDS.temporalSummaryDay,
      dependsOn: [SLEEP_STEP_IDS.lightSleep],
      optional: true,
    },
    {
      id: SLEEP_STEP_IDS.temporalSummaryCascade,
      handler: SLEEP_STEP_IDS.temporalSummaryCascade,
      dependsOn: [SLEEP_STEP_IDS.deepSleep],
      optional: true,
    },
    {
      id: SLEEP_STEP_IDS.memoryRefSync,
      handler: SLEEP_STEP_IDS.memoryRefSync,
      dependsOn: [SLEEP_STEP_IDS.deepSleep],
      optional: true,
    },
  ],
};
