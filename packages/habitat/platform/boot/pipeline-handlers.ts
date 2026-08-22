import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  resolveTemporalSummaryConfig,
  runTemporalSummaryCascade,
  runTemporalSummaryDay,
  scheduleTemporalSystemRollWarm,
  type SysRollKind,
} from "@freeanima/habitat/capabilities/memory/temporal-summary";
import { cstDayRange } from "@freeanima/habitat/capabilities/memory";
import { createEmbeddedMemoryService } from "@freeanima/habitat/capabilities/memory/service";
import { runRetainCatchUp } from "@freeanima/habitat/capabilities/memory/service/retain-catch-up";
import { planSleepCatchUp } from "@freeanima/habitat/capabilities/memory/sleep-catch-up";
import {
  runSelfLayerRefresh,
  runSelfLayerRefreshAllAgents,
} from "@freeanima/habitat/capabilities/self/refresh/run";
import type { BoundConversationAgent } from "@freeanima/habitat/engine/conversation/resolve-conversation-agent.ts";
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
import { cacheGetJson, cacheSetJson } from "@freeanima/habitat/core/redis";
import { asRecord } from "@freeanima/shared/util";

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
  /** 卧室手动维护：限定单个 Anima；省略则全部 enabled agent */
  agent_subject_id?: number;
};

/** 解析本步要跑的 agent 列表；显式 id 时只跑该 Anima（禁止回退默认聊天 agent）。 */
async function resolveMaintenanceAgents(
  agentSubjectId?: number,
): Promise<BoundConversationAgent[]> {
  const { assertBindableAgentSubject, listEnabledBoundAgents } =
    await import("@freeanima/habitat/engine/conversation/resolve-conversation-agent.ts");
  if (agentSubjectId != null && agentSubjectId > 0) {
    return [await assertBindableAgentSubject(agentSubjectId)];
  }
  return listEnabledBoundAgents();
}

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
    output: asRecord(result.output) ?? (result.output != null ? { value: result.output } : null),
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
  const result = await runRetainCatchUp(
    omitUndefined({ day: ctx.day, agent_subject_id: ctx.agent_subject_id }),
  );
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
  const agents = await resolveMaintenanceAgents(ctx.agent_subject_id);
  if (agents.length === 0) {
    return {
      ok: true,
      step_id: MAINTENANCE_STEP_IDS.reflect,
      status: "skipped",
      skipped_reason: "no_agents",
      output: { day: ctx.day, mode },
    };
  }
  const perAgent = [];
  for (const agent of agents) {
    const reflectResult = await createEmbeddedMemoryService().reflect({
      force: mode === "full",
      world_id: agent.agent_world_id,
      agent_subject_id: agent.agent_subject_id,
    });
    perAgent.push({
      agent_subject_id: agent.agent_subject_id,
      world_id: agent.agent_world_id,
      ...reflectResult,
    });
  }
  return {
    ok: true,
    step_id: MAINTENANCE_STEP_IDS.reflect,
    status: "completed",
    output: {
      day: ctx.day,
      mode,
      agents: perAgent,
      summary: "MemoryService.reflect per agent",
    },
  };
}

async function runSemanticClusterCalibrateStep(ctx: StepCtx): Promise<MaintenanceStepResult> {
  const { calibrateSemanticMemoryClusters } =
    await import("@freeanima/habitat/capabilities/memory/clustering/calibrate.ts");
  try {
    const agents = await resolveMaintenanceAgents(ctx.agent_subject_id);
    if (agents.length === 0) {
      return {
        ok: true,
        step_id: MAINTENANCE_STEP_IDS.semanticClusterCalibrate,
        status: "skipped",
        skipped_reason: "no_agents",
      };
    }
    const results = [];
    for (const agent of agents) {
      results.push(await calibrateSemanticMemoryClusters({ world_id: agent.agent_world_id }));
    }
    const ok = results.every((r) => r.ok);
    const allSkipped = results.every((r) => r.skipped);
    return {
      ok,
      step_id: MAINTENANCE_STEP_IDS.semanticClusterCalibrate,
      status: allSkipped ? "skipped" : ok ? "completed" : "failed",
      output: { agents: results },
      ...omitUndefined({
        skipped_reason: allSkipped ? results[0]?.reason : undefined,
        error: ok
          ? undefined
          : results
              .map((r) => r.reason)
              .filter(Boolean)
              .join("; "),
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

/** 簇短标题预热：fail-open，不拖垮整周期 */
async function runSemanticClusterTitleStep(ctx: StepCtx): Promise<MaintenanceStepResult> {
  try {
    const { listSemanticMemoryClusterStats } =
      await import("@freeanima/habitat/core/db/pg/search/clustering-repo.ts");
    const { warmSemanticClusterTitles } =
      await import("@freeanima/habitat/capabilities/memory/clustering/cluster-title.ts");
    const agents = await resolveMaintenanceAgents(ctx.agent_subject_id);
    if (agents.length === 0) {
      return {
        ok: true,
        step_id: MAINTENANCE_STEP_IDS.semanticClusterTitle,
        status: "skipped",
        skipped_reason: "no_agents",
        output: { attempted: 0, ok: 0 },
      };
    }
    const warmed = [];
    for (const agent of agents) {
      const stats = await listSemanticMemoryClusterStats({
        status: "active",
        world_id: agent.agent_world_id,
      });
      const clusterIds = stats
        .map((s) => s.cluster_id)
        .filter((id): id is number => id != null && Number.isInteger(id) && id >= 0)
        .toSorted((a, b) => a - b);
      if (clusterIds.length === 0) {
        warmed.push({
          agent_subject_id: agent.agent_subject_id,
          attempted: 0,
          ok: 0,
          skipped_reason: "empty",
        });
        continue;
      }
      const warm = await warmSemanticClusterTitles(clusterIds, {
        world_id: agent.agent_world_id,
      });
      warmed.push({ agent_subject_id: agent.agent_subject_id, ...warm });
    }
    return {
      ok: true,
      step_id: MAINTENANCE_STEP_IDS.semanticClusterTitle,
      status: "completed",
      output: { agents: warmed },
    };
  } catch (err) {
    logComponent("memory.clustering").warn("cluster title warm step failed", {
      error: String(err),
    });
    return {
      ok: true,
      step_id: MAINTENANCE_STEP_IDS.semanticClusterTitle,
      status: "skipped",
      skipped_reason: String(err),
      output: { error: String(err) },
    };
  }
}

async function runSelfLayerRefreshStep(ctx: StepCtx): Promise<MaintenanceStepResult> {
  const result =
    ctx.agent_subject_id != null && ctx.agent_subject_id > 0
      ? await runSelfLayerRefresh({ agent_subject_id: ctx.agent_subject_id })
      : await runSelfLayerRefreshAllAgents();
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
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  const agents = await resolveMaintenanceAgents(ctx.agent_subject_id);
  if (agents.length === 0) {
    return {
      ok: true,
      step_id: MAINTENANCE_STEP_IDS.temporalSummaryDay,
      status: "skipped",
      skipped_reason: "no_agents",
      output: { day: ctx.day },
    };
  }
  const results = [];
  let anyOk = false;
  let anyFail = false;
  for (const agent of agents) {
    const result = await runTemporalSummaryDay(
      omitUndefined({
        day: ctx.day,
        config,
        agent_subject_id: agent.agent_subject_id,
        world_id: agent.agent_world_id,
      }),
    );
    results.push(result);
    if (result.ok) anyOk = true;
    else anyFail = true;
  }
  if (anyOk) {
    for (const agent of agents) {
      scheduleTemporalSystemRollWarm({
        kinds: ["past_days"] satisfies SysRollKind[],
        config,
        world_id: agent.agent_world_id,
        peerCache: { getJson: cacheGetJson, setJson: cacheSetJson },
      });
    }
  }
  const allSkipped = results.every((r) => r.skipped);
  return {
    ok: !anyFail,
    step_id: MAINTENANCE_STEP_IDS.temporalSummaryDay,
    status: anyFail ? "failed" : allSkipped ? "skipped" : "completed",
    ...(allSkipped && results[0]?.skipped ? { skipped_reason: results[0].skipped } : {}),
    output: { day: ctx.day, agents: results },
    ...omitUndefined({
      error: anyFail
        ? results
            .filter((r) => !r.ok)
            .map((r) => r.summary)
            .join("; ")
        : undefined,
    }),
  };
}

async function runTemporalCascadeStep(ctx: StepCtx): Promise<MaintenanceStepResult> {
  const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
  const agents = await resolveMaintenanceAgents(ctx.agent_subject_id);
  if (agents.length === 0) {
    return {
      ok: true,
      step_id: MAINTENANCE_STEP_IDS.temporalSummaryCascade,
      status: "skipped",
      skipped_reason: "no_agents",
      output: { day: ctx.day },
    };
  }
  const results = [];
  let anyFail = false;
  for (const agent of agents) {
    const result = await runTemporalSummaryCascade(
      omitUndefined({
        day: ctx.day,
        config,
        agent_subject_id: agent.agent_subject_id,
        world_id: agent.agent_world_id,
      }),
    );
    results.push(result);
    if (!result.ok) anyFail = true;
    const kinds: SysRollKind[] = [];
    if (result.month_id != null) kinds.push("past_months");
    if (result.year_id != null) kinds.push("past_years");
    if (result.ok && kinds.length > 0) {
      scheduleTemporalSystemRollWarm({
        kinds,
        config,
        world_id: agent.agent_world_id,
        peerCache: { getJson: cacheGetJson, setJson: cacheSetJson },
      });
    }
  }
  const allSkipped = results.every((r) => r.skipped);
  return {
    ok: !anyFail,
    step_id: MAINTENANCE_STEP_IDS.temporalSummaryCascade,
    status: anyFail ? "failed" : allSkipped ? "skipped" : "completed",
    ...(allSkipped && results[0]?.skipped ? { skipped_reason: results[0].skipped } : {}),
    output: { day: ctx.day, agents: results },
    ...omitUndefined({
      error: anyFail
        ? results
            .filter((r) => !r.ok)
            .map((r) => r.summary)
            .join("; ")
        : undefined,
    }),
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
    agent_subject_id?: number;
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
      agent_subject_id: opts?.agent_subject_id,
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
      result = await runSemanticClusterCalibrateStep(ctx);
      break;
    case MAINTENANCE_STEP_IDS.reflect:
      result = await runReflectStep(ctx);
      break;
    case MAINTENANCE_STEP_IDS.selfLayerRefresh:
      result = await runSelfLayerRefreshStep(ctx);
      break;
    case MAINTENANCE_STEP_IDS.semanticClusterTitle:
      result = await runSemanticClusterTitleStep(ctx);
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

  // 单 Anima 手动维护不写实例级 watermark，避免污染全实例补跑计划
  if (ctx.agent_subject_id == null) {
    await recordStepWatermark(mapped, day, ctx.trigger, result);
  }
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

    // 族名预热在 reflect / self 之后：失败不影响反思；列表页仍可懒生成
    const titles = await runMemoryMaintenanceStep(MAINTENANCE_STEP_IDS.semanticClusterTitle, {
      day,
      trigger,
    });
    steps[titles.step_id] = titles;
    if (!titles.ok) ok = false;
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
