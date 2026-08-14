import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  resolveTemporalSummaryConfig,
  runTemporalSummaryCascade,
  runTemporalSummaryDay,
} from "@freeanima/habitat/capabilities/memory/temporal-summary";
import { cstDayRange } from "@freeanima/habitat/capabilities/memory";
import { createEmbeddedMemoryService } from "@freeanima/habitat/capabilities/memory/service";
import { runRetainCatchUp } from "@freeanima/habitat/capabilities/memory/service/retain-catch-up";
import { runSelfLayerRefresh } from "@freeanima/habitat/capabilities/self/refresh/run";
import { loadSelfLayerPrompt } from "@freeanima/habitat/capabilities/self";
import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { purgeStaleAutoLlmRuns } from "@freeanima/habitat/core/db/pg/auto-llm-run";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import {
  ENTITY_SOFT_DELETE_RETENTION_DAYS,
  purgeSoftDeletedEntities,
} from "@freeanima/habitat/core/db/pg/entity";
import { getPipelineRunner, type PipelineStepTrigger } from "@freeanima/habitat/engine/pipeline";
import { cleanupStaleConversations } from "@freeanima/habitat/engine/conversation";
import type { Engine } from "@freeanima/habitat/engine";
import { gcObjectBlobsAfterEntityPurge } from "@freeanima/features/object-storage/domain";
import { purgeCronConversations } from "@freeanima/habitat/core/db/pg/conversation";

import {
  memoryMaintenanceDefinition,
  MEMORY_MAINTENANCE_PIPELINE_ID,
  MAINTENANCE_STEP_IDS,
  SLEEP_CYCLE_PIPELINE_ID,
  SLEEP_STEP_IDS,
} from "./sleep-cycle.ts";

export {
  MEMORY_MAINTENANCE_PIPELINE_ID,
  SLEEP_CYCLE_PIPELINE_ID,
  MAINTENANCE_STEP_IDS,
  SLEEP_STEP_IDS,
};

/** 注册记忆维护 pipeline 定义与各 step handler */
export function registerSleepPipeline(engine: Engine): void {
  const runner = getPipelineRunner();
  runner.registerDefinition(memoryMaintenanceDefinition);

  runner.registerStep(MAINTENANCE_STEP_IDS.conversationCleanup, async () => {
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

    const sample_ids = result.ids.slice(0, 20);
    return {
      ok: true,
      output: {
        deleted: result.deleted,
        sample_ids,
        cron_sessions_purged: cronPurge.deleted,
        auto_llm_runs_purged: autoLlmPurged.deleted,
        soft_deleted_entities_purged: entitiesPurged,
        object_storage_blobs_gc: objectBlobsGc,
      },
    };
  });

  runner.registerStep(MAINTENANCE_STEP_IDS.retainCatchUp, async (ctx) => {
    const result = await runRetainCatchUp(
      omitUndefined({ day: typeof ctx.day === "string" ? ctx.day : undefined }),
    );
    if (result.skipped_reason) {
      return { ok: true, skipped: result.skipped_reason, output: result };
    }
    return result.ok
      ? { ok: true, output: result }
      : { ok: false, output: result, error: result.summary };
  });

  runner.registerStep(MAINTENANCE_STEP_IDS.reflect, async (ctx) => {
    const { resolveDeepSleepMode } = await import("./deep-sleep-mode.ts");
    const mode = resolveDeepSleepMode(ctx);
    const reflectResult = await createEmbeddedMemoryService().reflect({
      force: mode === "full",
    });
    return {
      ok: true,
      output: {
        day: ctx.day,
        mode,
        ...reflectResult,
        summary: "MemoryService.reflect",
      },
    };
  });

  runner.registerStep(MAINTENANCE_STEP_IDS.selfLayerRefresh, async () => {
    const selfContent = await loadSelfLayerPrompt();
    const result = await runSelfLayerRefresh(omitUndefined({ selfContent }));
    if (result.skipped) {
      return { ok: true, skipped: result.skipped, output: result };
    }
    return result.ok
      ? { ok: true, output: result }
      : { ok: false, output: result, error: result.summary };
  });

  runner.registerStep(MAINTENANCE_STEP_IDS.temporalSummaryDay, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
    const result = await runTemporalSummaryDay(
      omitUndefined({ day: ctx.day, selfContent, config }),
    );
    if (result.skipped) {
      return { ok: true, skipped: result.skipped, output: result };
    }
    return result.ok
      ? { ok: true, output: result }
      : { ok: false, output: result, error: result.summary };
  });

  runner.registerStep(MAINTENANCE_STEP_IDS.temporalSummaryCascade, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const config = resolveTemporalSummaryConfig(getActiveRuntimeConfig().data);
    const result = await runTemporalSummaryCascade(
      omitUndefined({ day: ctx.day, selfContent, config }),
    );
    if (result.skipped) {
      return { ok: true, skipped: result.skipped, output: result };
    }
    return result.ok
      ? { ok: true, output: result }
      : { ok: false, output: result, error: result.summary };
  });
}

export function resolveSleepCycleDay(day?: string): string {
  return cstDayRange(day).day;
}

export async function runSleepCycle(
  day?: string,
  opts?: { trigger?: PipelineStepTrigger; deep_sleep_mode?: "full" | "incremental" },
) {
  const runner = getPipelineRunner();
  const resolvedDay = resolveSleepCycleDay(day);
  return runner.run(MEMORY_MAINTENANCE_PIPELINE_ID, {
    day: resolvedDay,
    trigger: opts?.trigger ?? "manual_cycle",
    ...omitUndefined({ deep_sleep_mode: opts?.deep_sleep_mode }),
  });
}

export async function runSleepStep(
  stepId: string,
  opts?: {
    day?: string;
    force?: boolean;
    trigger?: PipelineStepTrigger;
    deep_sleep_mode?: "full" | "incremental";
  },
) {
  const runner = getPipelineRunner();
  const resolvedDay = opts?.day ? resolveSleepCycleDay(opts.day) : resolveSleepCycleDay();
  // 旧 step id 映射
  const mapped =
    stepId === "light-sleep"
      ? MAINTENANCE_STEP_IDS.retainCatchUp
      : stepId === "deep-sleep"
        ? MAINTENANCE_STEP_IDS.reflect
        : stepId;
  return runner.runStep(
    mapped,
    omitUndefined({
      day: resolvedDay,
      force: opts?.force,
      trigger: opts?.trigger ?? "manual_step",
      deep_sleep_mode: opts?.deep_sleep_mode,
    }),
  );
}

export function getSleepPipelineStatus() {
  const runner = getPipelineRunner();
  return runner.getRunState(MEMORY_MAINTENANCE_PIPELINE_ID);
}
