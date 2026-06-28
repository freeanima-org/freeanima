import { runLightSleep } from "@freeanima/capabilities-memory/light-sleep/run";
import { runDeepSleep } from "@freeanima/capabilities-memory/deep-sleep/run";
import { runDream } from "@freeanima/capabilities-memory/dream/run";
import { cstDayRange, syncSemanticMemoryReferenceCounts } from "@freeanima/capabilities-memory";
import {
  invalidateSelfLayerPromptCache,
  loadSelfLayerPrompt,
} from "@freeanima/capabilities-identity";
import { purgeStaleAutoLlmRuns } from "@freeanima/core/db/pg/auto-llm-run";
import { isPostgresPrimary } from "@freeanima/core/db/pg";
import { getPipelineRunner, type PipelineStepTrigger } from "@freeanima/runtime/pipeline";
import { cleanupStaleConversations } from "@freeanima/runtime/conversation";
import type { Engine } from "@freeanima/runtime";

import { purgeCronConversations } from "@freeanima/core/db/pg/conversation";
import { createDreamFridgePort } from "../dream-fridge-factory.ts";
import { resolveDeepSleepMode } from "./deep-sleep-mode.ts";
import { sleepCycleDefinition, SLEEP_CYCLE_PIPELINE_ID, SLEEP_STEP_IDS } from "./sleep-cycle.ts";

/** 注册睡眠周期 pipeline 定义与各 step handler */
export function registerSleepPipeline(engine: Engine): void {
  const runner = getPipelineRunner();
  runner.registerDefinition(sleepCycleDefinition);

  runner.registerStep(SLEEP_STEP_IDS.conversationCleanup, async () => {
    const result = await cleanupStaleConversations();
    const cronPurge = await purgeCronConversations();

    const autoLlmCfg = engine.config.data.auto_llm;
    const retentionDays = autoLlmCfg?.retention_days ?? 30;
    const perRunKindKeep = autoLlmCfg?.per_run_kind_keep ?? 100;
    let autoLlmPurged = { deleted: 0 };
    if (isPostgresPrimary() && retentionDays > 0) {
      const olderThan = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      autoLlmPurged = await purgeStaleAutoLlmRuns({
        olderThan,
        perRunKindKeep,
      });
    }

    const sample_ids = result.ids.slice(0, 20);
    return {
      ok: true,
      output: {
        deleted: result.deleted,
        sample_ids,
        cron_sessions_purged: cronPurge.deleted,
        auto_llm_runs_purged: autoLlmPurged.deleted,
      },
    };
  });

  runner.registerStep(SLEEP_STEP_IDS.lightSleep, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const result = await runLightSleep({
      day: ctx.day,
      selfContent,
    });
    if (result.skipped) {
      return { ok: true, skipped: result.skipped, output: result };
    }
    return { ok: result.ok, output: result, error: result.ok ? undefined : result.summary };
  });

  runner.registerStep(SLEEP_STEP_IDS.deepSleep, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const mode = resolveDeepSleepMode(ctx);
    const result = await runDeepSleep({ day: ctx.day, selfContent, mode });
    if (result.skipped) {
      return { ok: true, skipped: result.skipped, output: result };
    }
    return {
      ok: result.ok,
      output: result,
      error: result.ok ? undefined : (result.skipped ?? "deep sleep failed"),
    };
  });

  runner.registerStep(SLEEP_STEP_IDS.dream, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const result = await runDream({
      day: ctx.day,
      selfContent,
      fridge: createDreamFridgePort(),
    });
    if (result.skipped) {
      return { ok: true, skipped: result.skipped, output: result };
    }
    return { ok: result.ok, output: result, error: result.ok ? undefined : result.summary };
  });

  runner.registerStep(SLEEP_STEP_IDS.selfLayerRefresh, async () => {
    invalidateSelfLayerPromptCache();
    await loadSelfLayerPrompt();
    return { ok: true, output: { refreshed: true } };
  });

  runner.registerStep(SLEEP_STEP_IDS.memoryRefSync, async () => {
    const result = await syncSemanticMemoryReferenceCounts();
    return { ok: true, output: result };
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
  return runner.run(SLEEP_CYCLE_PIPELINE_ID, {
    day: resolvedDay,
    trigger: opts?.trigger ?? "manual_cycle",
    deep_sleep_mode: opts?.deep_sleep_mode,
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
  return runner.runStep(stepId, {
    day: resolvedDay,
    force: opts?.force,
    trigger: opts?.trigger ?? "manual_step",
    deep_sleep_mode: opts?.deep_sleep_mode,
  });
}

export function getSleepPipelineStatus() {
  const runner = getPipelineRunner();
  return runner.getRunState(SLEEP_CYCLE_PIPELINE_ID);
}
