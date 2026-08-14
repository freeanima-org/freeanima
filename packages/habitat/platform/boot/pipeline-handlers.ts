import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  resolveTemporalSummaryConfig,
  runTemporalSummaryCascade,
  runTemporalSummaryDay,
} from "@freeanima/habitat/capabilities/memory/temporal-summary";
import { cstDayRange } from "@freeanima/habitat/capabilities/memory";
import { createEmbeddedMemoryService } from "@freeanima/habitat/capabilities/memory/service";
import { runRetainCatchUp } from "@freeanima/habitat/capabilities/memory/service/retain-catch-up";
import { planSleepCatchUp } from "@freeanima/habitat/capabilities/memory/sleep-catch-up";
import { runSelfLayerRefresh } from "@freeanima/habitat/capabilities/self/refresh/run";
import { loadSelfLayerPrompt } from "@freeanima/habitat/capabilities/self";
import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { purgeStaleAutoLlmRuns } from "@freeanima/habitat/core/db/pg/auto-llm-run";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import {
  ENTITY_SOFT_DELETE_RETENTION_DAYS,
  purgeSoftDeletedEntities,
} from "@freeanima/habitat/core/db/pg/entity";
import { appendPipelineStepRun } from "@freeanima/habitat/core/db/pg/pipeline";
import { cleanupStaleConversations } from "@freeanima/habitat/engine/conversation";
import type { ServiceEnginePort } from "@freeanima/habitat/platform/ports/service-engine";
import { gcObjectBlobsAfterEntityPurge } from "@freeanima/features/object-storage/domain";
import { purgeCronConversations } from "@freeanima/habitat/core/db/pg/conversation";
import { formatCstIso } from "@freeanima/habitat/core/util";
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/habitat/core/soft-failure";

import {
  MEMORY_MAINTENANCE_PIPELINE_ID,
  MAINTENANCE_STEP_IDS,
  shouldRunScheduledReflect,
  type MaintenanceTrigger,
} from "./memory-maintenance.ts";
import { resolveReflectMode } from "./reflect-schedule.ts";

export { MEMORY_MAINTENANCE_PIPELINE_ID, MAINTENANCE_STEP_IDS };
export type { MaintenanceTrigger };

export type MaintenanceStepResult = {
  ok: boolean;
  step_id: string;
  status: "completed" | "skipped" | "failed";
  output?: unknown;
  error?: string;
  skipped_reason?: string;
};

export type MaintenanceCycleResult = {
  ok: boolean;
  day: string;
  status: "completed" | "failed";
  steps: Record<string, MaintenanceStepResult>;
  retain_gap?: {
    light_days: string[];
    notified: boolean;
  };
};

type StepCtx = {
  day: string;
  force?: boolean;
  trigger: MaintenanceTrigger;
  reflect_mode?: "full" | "incremental";
};

function newRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 补跑计划仍读 pipeline_step_run；成功后写 watermark（非运维历史 UI） */
async function recordStepWatermark(
  stepId: string,
  day: string,
  trigger: MaintenanceTrigger,
  result: MaintenanceStepResult,
): Promise<void> {
  if (!isPostgresPrimary()) return;
  if (
    stepId !== MAINTENANCE_STEP_IDS.retainCatchUp &&
    stepId !== MAINTENANCE_STEP_IDS.temporalSummaryDay &&
    stepId !== MAINTENANCE_STEP_IDS.temporalSummaryCascade
  ) {
    return;
  }
  if (result.status !== "completed" && result.status !== "skipped") return;

  await appendPipelineStepRun({
    pipeline_id: MEMORY_MAINTENANCE_PIPELINE_ID,
    run_id: newRunId(),
    step_id: stepId,
    day,
    trigger,
    status: result.status,
    started_at: null,
    finished_at: formatCstIso(),
    output:
      result.output != null && typeof result.output === "object" && !Array.isArray(result.output)
        ? (result.output as Record<string, unknown>)
        : result.output != null
          ? { value: result.output }
          : null,
    error: result.error ?? null,
    skipped_reason: result.skipped_reason ?? null,
  });
}

async function runConversationCleanup(engine: ServiceEnginePort): Promise<MaintenanceStepResult> {
  const result = await cleanupStaleConversations();
  const cronPurge = await purgeCronConversations();

  const autoLlmCfg = engine.config.data.auto_llm;
  const retentionDays = autoLlmCfg?.retention_days ?? 30;
  const perRunKindKeep = autoLlmCfg?.per_run_kind_keep ?? 100;
  let autoLlmPurged = { deleted: 0 };
  let entitiesPurged = 0;
  let objectBlobsGc = { candidates: 0, deleted: 0, skipped_referenced: 0, skipped_errors: 0 };
  if (isPostgresPrimary() && retentionDays > 0) {
    const olderThan = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    autoLlmPurged = await purgeStaleAutoLlmRuns({
      olderThan,
      perRunKindKeep,
    });
  }
  if (isPostgresPrimary() && ENTITY_SOFT_DELETE_RETENTION_DAYS > 0) {
    const entityOlderThan = new Date(
      Date.now() - ENTITY_SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const purgeResult = await purgeSoftDeletedEntities({ olderThan: entityOlderThan });
    entitiesPurged = purgeResult.purged;
    objectBlobsGc = await gcObjectBlobsAfterEntityPurge(purgeResult.rows);
  }

  return {
    ok: true,
    step_id: MAINTENANCE_STEP_IDS.conversationCleanup,
    status: "completed",
    output: {
      deleted: result.deleted,
      sample_ids: result.ids.slice(0, 20),
      cron_sessions_purged: cronPurge.deleted,
      auto_llm_runs_purged: autoLlmPurged.deleted,
      soft_deleted_entities_purged: entitiesPurged,
      object_storage_blobs_gc: objectBlobsGc,
    },
  };
}

async function runRetainCatchUpStep(ctx: StepCtx): Promise<MaintenanceStepResult> {
  const result = await runRetainCatchUp(omitUndefined({ day: ctx.day }));
  if (result.skipped_reason) {
    return {
      ok: true,
      step_id: MAINTENANCE_STEP_IDS.retainCatchUp,
      status: "skipped",
      skipped_reason: result.skipped_reason,
      output: result,
    };
  }
  return {
    ok: result.ok,
    step_id: MAINTENANCE_STEP_IDS.retainCatchUp,
    status: result.ok ? "completed" : "failed",
    output: result,
    ...omitUndefined({ error: result.ok ? undefined : result.summary }),
  };
}

async function runReflectStep(ctx: StepCtx): Promise<MaintenanceStepResult> {
  const mode = resolveReflectMode({
    trigger: ctx.trigger,
    day: ctx.day,
    ...omitUndefined({ reflect_mode: ctx.reflect_mode }),
  });
  const reflectResult = await createEmbeddedMemoryService().reflect({
    force: mode === "full",
  });
  return {
    ok: true,
    step_id: MAINTENANCE_STEP_IDS.reflect,
    status: "completed",
    output: {
      day: ctx.day,
      mode,
      ...reflectResult,
      summary: "MemoryService.reflect",
    },
  };
}

async function runSemanticClusterCalibrateStep(): Promise<MaintenanceStepResult> {
  const { calibrateSemanticMemoryClusters } =
    await import("@freeanima/habitat/capabilities/memory/clustering/calibrate.ts");
  try {
    const result = await calibrateSemanticMemoryClusters();
    return {
      ok: result.ok,
      step_id: MAINTENANCE_STEP_IDS.semanticClusterCalibrate,
      status: result.skipped ? "skipped" : result.ok ? "completed" : "failed",
      output: result,
      ...omitUndefined({
        skipped_reason: result.skipped ? result.reason : undefined,
        error: result.ok ? undefined : result.reason,
      }),
    };
  } catch (err) {
    return {
      ok: false,
      step_id: MAINTENANCE_STEP_IDS.semanticClusterCalibrate,
      status: "failed",
      error: String(err),
    };
  }
}

async function runSelfLayerRefreshStep(): Promise<MaintenanceStepResult> {
  const selfContent = await loadSelfLayerPrompt();
  const result = await runSelfLayerRefresh(omitUndefined({ selfContent }));
  if (result.skipped) {
    return {
      ok: true,
      step_id: MAINTENANCE_STEP_IDS.selfLayerRefresh,
      status: "skipped",
      skipped_reason: result.skipped,
      output: result,
    };
  }
  return {
    ok: result.ok,
    step_id: MAINTENANCE_STEP_IDS.selfLayerRefresh,
    status: result.ok ? "completed" : "failed",
    output: result,
    ...omitUndefined({ error: result.ok ? undefined : result.summary }),
  };
}

async function runTemporalDayStep(ctx: StepCtx): Promise<MaintenanceStepResult> {
  const selfContent = await loadSelfLayerPrompt();
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  const result = await runTemporalSummaryDay(omitUndefined({ day: ctx.day, selfContent, config }));
  if (result.skipped) {
    return {
      ok: true,
      step_id: MAINTENANCE_STEP_IDS.temporalSummaryDay,
      status: "skipped",
      skipped_reason: result.skipped,
      output: result,
    };
  }
  return {
    ok: result.ok,
    step_id: MAINTENANCE_STEP_IDS.temporalSummaryDay,
    status: result.ok ? "completed" : "failed",
    output: result,
    ...omitUndefined({ error: result.ok ? undefined : result.summary }),
  };
}

async function runTemporalCascadeStep(ctx: StepCtx): Promise<MaintenanceStepResult> {
  const selfContent = await loadSelfLayerPrompt();
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  const result = await runTemporalSummaryCascade(
    omitUndefined({ day: ctx.day, selfContent, config }),
  );
  if (result.skipped) {
    return {
      ok: true,
      step_id: MAINTENANCE_STEP_IDS.temporalSummaryCascade,
      status: "skipped",
      skipped_reason: result.skipped,
      output: result,
    };
  }
  return {
    ok: result.ok,
    step_id: MAINTENANCE_STEP_IDS.temporalSummaryCascade,
    status: result.ok ? "completed" : "failed",
    output: result,
    ...omitUndefined({ error: result.ok ? undefined : result.summary }),
  };
}

function mapLegacyStepId(stepId: string): string {
  if (stepId === "light-sleep") return MAINTENANCE_STEP_IDS.retainCatchUp;
  if (stepId === "deep-sleep") return MAINTENANCE_STEP_IDS.reflect;
  return stepId;
}

export function resolveMemoryMaintenanceDay(day?: string): string {
  return cstDayRange(day).day;
}

/** @deprecated 使用 resolveMemoryMaintenanceDay */
export const resolveSleepCycleDay = resolveMemoryMaintenanceDay;

/**
 * 执行单步维护（不经 PipelineRunner）。
 * retain / temporal 成功或跳过时写 watermark，供补跑计划跳过已完成日。
 */
export async function runMemoryMaintenanceStep(
  stepId: string,
  opts?: {
    day?: string;
    force?: boolean;
    trigger?: MaintenanceTrigger;
    reflect_mode?: "full" | "incremental";
    engine?: ServiceEnginePort;
  },
): Promise<MaintenanceStepResult> {
  const mapped = mapLegacyStepId(stepId);
  const day = opts?.day ? resolveMemoryMaintenanceDay(opts.day) : resolveMemoryMaintenanceDay();
  const ctx: StepCtx = {
    day,
    trigger: opts?.trigger ?? "manual_step",
    ...omitUndefined({
      force: opts?.force,
      reflect_mode: opts?.reflect_mode,
    }),
  };

  let result: MaintenanceStepResult;
  switch (mapped) {
    case MAINTENANCE_STEP_IDS.conversationCleanup: {
      if (!opts?.engine) {
        return {
          ok: false,
          step_id: mapped,
          status: "failed",
          error: "engine required for conversation-cleanup",
        };
      }
      result = await runConversationCleanup(opts.engine);
      break;
    }
    case MAINTENANCE_STEP_IDS.retainCatchUp:
      result = await runRetainCatchUpStep(ctx);
      break;
    case MAINTENANCE_STEP_IDS.semanticClusterCalibrate:
      result = await runSemanticClusterCalibrateStep();
      break;
    case MAINTENANCE_STEP_IDS.reflect:
      result = await runReflectStep(ctx);
      break;
    case MAINTENANCE_STEP_IDS.selfLayerRefresh:
      result = await runSelfLayerRefreshStep();
      break;
    case MAINTENANCE_STEP_IDS.temporalSummaryDay:
      result = await runTemporalDayStep(ctx);
      break;
    case MAINTENANCE_STEP_IDS.temporalSummaryCascade:
      result = await runTemporalCascadeStep(ctx);
      break;
    default:
      return {
        ok: false,
        step_id: stepId,
        status: "failed",
        error: `unknown maintenance step: ${stepId}`,
      };
  }

  await recordStepWatermark(mapped, day, ctx.trigger, result);
  return result;
}

/** @deprecated 使用 runMemoryMaintenanceStep */
export const runSleepStep = runMemoryMaintenanceStep;

/** Retain 缺口检查：有缺口则 Inbox 通知，不自动补跑 */
export async function checkRetainGapsAndNotify(): Promise<{
  light_days: string[];
  notified: boolean;
}> {
  const planned = await planSleepCatchUp();
  if (!planned.ok) {
    return { light_days: [], notified: false };
  }
  const light_days = planned.plan.light_days;
  if (light_days.length === 0) {
    return { light_days: [], notified: false };
  }

  const preview = light_days.slice(0, 12).join(", ");
  const more = light_days.length > 12 ? ` 等共 ${String(light_days.length)} 天` : "";
  logComponent("memory").warn("retain gap detected (nightly check only)", {
    count: light_days.length,
    sample: light_days.slice(0, 5),
  });
  void notifySoftFailure({
    sourceRef: cstDaySourceRef("memory_maintenance:retain_gap"),
    title: "Retain 补跑缺口",
    body: [
      "夜间检查发现有活动日尚未完成 Retain 补跑（不会自动执行）。",
      "请到语义记忆页手动「Retain 补跑」或「一键补跑」。",
      `缺口日：${preview}${more}`,
    ].join("\n"),
    payload: {
      kind: "retain_gap",
      light_days,
      start: planned.plan.start,
      end: planned.plan.end,
    },
    logLabel: "retain_gap",
  });
  return { light_days, notified: true };
}

/**
 * 夜间 / 手动完整周期：cleanup → gap-check →（周一）calibrate→reflect→self → temporal day→cascade。
 * **不**自动跑 retain 补跑。
 */
export async function runNightlyMemoryMaintenance(
  engine: ServiceEnginePort,
  opts?: {
    day?: string;
    trigger?: MaintenanceTrigger;
    reflect_mode?: "full" | "incremental";
    skipGapCheck?: boolean;
  },
): Promise<MaintenanceCycleResult> {
  const day = resolveMemoryMaintenanceDay(opts?.day);
  const trigger = opts?.trigger ?? "scheduled";
  const steps: Record<string, MaintenanceStepResult> = {};
  let ok = true;

  const cleanup = await runMemoryMaintenanceStep(MAINTENANCE_STEP_IDS.conversationCleanup, {
    day,
    trigger,
    engine,
  });
  steps[cleanup.step_id] = cleanup;
  if (!cleanup.ok) ok = false;

  let retain_gap: MaintenanceCycleResult["retain_gap"];
  if (!opts?.skipGapCheck) {
    retain_gap = await checkRetainGapsAndNotify();
  }

  if (trigger !== "scheduled" || shouldRunScheduledReflect(day)) {
    const calibrate = await runMemoryMaintenanceStep(
      MAINTENANCE_STEP_IDS.semanticClusterCalibrate,
      { day, trigger },
    );
    steps[calibrate.step_id] = calibrate;
    if (!calibrate.ok) ok = false;

    const reflect = await runMemoryMaintenanceStep(MAINTENANCE_STEP_IDS.reflect, {
      day,
      trigger,
      ...omitUndefined({ reflect_mode: opts?.reflect_mode }),
    });
    steps[reflect.step_id] = reflect;
    if (!reflect.ok) ok = false;

    if (reflect.ok) {
      const self = await runMemoryMaintenanceStep(MAINTENANCE_STEP_IDS.selfLayerRefresh, {
        day,
        trigger,
      });
      steps[self.step_id] = self;
      if (!self.ok) ok = false;
    }
  }

  const temporalDay = await runMemoryMaintenanceStep(MAINTENANCE_STEP_IDS.temporalSummaryDay, {
    day,
    trigger,
  });
  steps[temporalDay.step_id] = temporalDay;
  if (!temporalDay.ok) ok = false;

  const cascade = await runMemoryMaintenanceStep(MAINTENANCE_STEP_IDS.temporalSummaryCascade, {
    day,
    trigger,
  });
  steps[cascade.step_id] = cascade;
  if (!cascade.ok) ok = false;

  return {
    ok,
    day,
    status: ok ? "completed" : "failed",
    steps,
    ...omitUndefined({ retain_gap }),
  };
}

/** 手动完整周期（与夜间同序；默认也做 gap-check） */
export async function runMemoryMaintenance(
  engine: ServiceEnginePort,
  day?: string,
  opts?: { trigger?: MaintenanceTrigger; reflect_mode?: "full" | "incremental" },
): Promise<MaintenanceCycleResult> {
  return runNightlyMemoryMaintenance(engine, {
    ...omitUndefined({ day, reflect_mode: opts?.reflect_mode }),
    trigger: opts?.trigger ?? "manual_cycle",
  });
}

/** @deprecated 使用 runMemoryMaintenance */
export const runSleepCycle = runMemoryMaintenance;

/** 兼容旧调用：不再注册 PipelineRunner */
export function registerSleepPipeline(_engine: ServiceEnginePort): void {
  // no-op：记忆维护已脱离 DAG
}

export function getMemoryMaintenanceStatus(): null {
  return null;
}

/** @deprecated 使用 getMemoryMaintenanceStatus */
export const getSleepPipelineStatus = getMemoryMaintenanceStatus;
