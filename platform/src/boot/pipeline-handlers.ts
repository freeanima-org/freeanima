import { runLightSleep } from "@freeanima/capabilities-memory/light-sleep/run";
import { runDeepSleep } from "@freeanima/capabilities-memory/deep-sleep/run";
import { runDream } from "@freeanima/capabilities-memory/dream/run";
import { cstDayRange, syncSemanticMemoryReferenceCounts } from "@freeanima/capabilities-memory";
import {
  invalidateSelfLayerPromptCache,
  loadSelfLayerPrompt,
} from "@freeanima/capabilities-identity";
import { getPipelineRunner, type PipelineStepTrigger } from "@freeanima/runtime/pipeline";
import type { Engine } from "@freeanima/runtime";

import { createDreamFridgePort } from "../dream-fridge-factory.ts";
import { sleepCycleDefinition, SLEEP_CYCLE_PIPELINE_ID, SLEEP_STEP_IDS } from "./sleep-cycle.ts";

/** 注册睡眠周期 pipeline 定义与各 step handler */
export function registerSleepPipeline(engine: Engine): void {
  const runner = getPipelineRunner();
  runner.registerDefinition(sleepCycleDefinition);

  runner.registerStep(SLEEP_STEP_IDS.lightSleep, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const result = await runLightSleep({
      day: ctx.day,
      sessionStore: engine.repos.session,
      semanticStore: engine.repos.semanticMemory,
      autoStore: engine.repos.autobiographicalMemory,
      selfStore: engine.repos.selfLayer,
      selfContent,
    });
    if (result.skipped) {
      return { ok: true, skipped: result.skipped, output: result };
    }
    return { ok: result.ok, output: result, error: result.ok ? undefined : result.summary };
  });

  runner.registerStep(SLEEP_STEP_IDS.deepSleep, async (ctx) => {
    const selfContent = await loadSelfLayerPrompt();
    const result = await runDeepSleep({ day: ctx.day, selfContent });
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
      sessionStore: engine.repos.session,
      dreamStore: engine.repos.dreamMemory,
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
    const result = await syncSemanticMemoryReferenceCounts(engine.repos.memoryReference);
    return { ok: true, output: result };
  });
}

export function resolveSleepCycleDay(day?: string): string {
  return cstDayRange(day).day;
}

export async function runSleepCycle(day?: string, opts?: { trigger?: PipelineStepTrigger }) {
  const runner = getPipelineRunner();
  const resolvedDay = resolveSleepCycleDay(day);
  return runner.run(SLEEP_CYCLE_PIPELINE_ID, {
    day: resolvedDay,
    trigger: opts?.trigger ?? "manual_cycle",
  });
}

export async function runSleepStep(
  stepId: string,
  opts?: { day?: string; force?: boolean; trigger?: PipelineStepTrigger },
) {
  const runner = getPipelineRunner();
  const resolvedDay = opts?.day ? resolveSleepCycleDay(opts.day) : resolveSleepCycleDay();
  return runner.runStep(stepId, {
    day: resolvedDay,
    force: opts?.force,
    trigger: opts?.trigger ?? "manual_step",
  });
}

export function getSleepPipelineStatus() {
  const runner = getPipelineRunner();
  return runner.getRunState(SLEEP_CYCLE_PIPELINE_ID);
}
