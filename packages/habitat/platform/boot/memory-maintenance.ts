import { isCstMonday } from "@freeanima/habitat/core/util";

/** 记忆维护任务 id（原 sleep-cycle / pipeline id） */
export const MEMORY_MAINTENANCE_PIPELINE_ID = "memory-maintenance";

/** 记忆维护步骤 id（无 DAG；仅作稳定标识） */
export const MAINTENANCE_STEP_IDS = {
  conversationCleanup: "conversation-cleanup",
  retainCatchUp: "retain-catch-up",
  semanticClusterCalibrate: "semantic-cluster-calibrate",
  reflect: "reflect",
  selfLayerRefresh: "self-layer-refresh",
  /** 簇短标题预热（LLM）；与分族校准拆开，避免挡 reflect */
  semanticClusterTitle: "semantic-cluster-title",
  temporalSummaryDay: "temporal-summary-day",
  temporalSummaryCascade: "temporal-summary-cascade",
} as const;

export type MaintenanceStepId = (typeof MAINTENANCE_STEP_IDS)[keyof typeof MAINTENANCE_STEP_IDS];

/** 运维可触发的步骤清单（不依赖 PipelineDefinition） */
export const MAINTENANCE_STEP_LIST: readonly MaintenanceStepId[] = [
  MAINTENANCE_STEP_IDS.conversationCleanup,
  MAINTENANCE_STEP_IDS.retainCatchUp,
  MAINTENANCE_STEP_IDS.semanticClusterCalibrate,
  MAINTENANCE_STEP_IDS.reflect,
  MAINTENANCE_STEP_IDS.selfLayerRefresh,
  MAINTENANCE_STEP_IDS.semanticClusterTitle,
  MAINTENANCE_STEP_IDS.temporalSummaryDay,
  MAINTENANCE_STEP_IDS.temporalSummaryCascade,
];

export function isKnownMaintenanceStep(stepId: string): boolean {
  return (
    (MAINTENANCE_STEP_LIST as readonly string[]).includes(stepId) ||
    stepId === "light-sleep" ||
    stepId === "deep-sleep"
  );
}

export type MaintenanceTrigger = "scheduled" | "manual_cycle" | "manual_step" | "catch_up";

/** 定时路径：CST 周一才跑 reflect / self-refresh */
export function shouldRunScheduledReflect(day: string): boolean {
  return isCstMonday(day);
}
