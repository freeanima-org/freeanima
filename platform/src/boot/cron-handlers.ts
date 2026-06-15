import { registerCronBuiltinHandler } from "@freeanima/platform/connectors/cron";
import { registerSleepPipeline, runSleepCycle, resolveSleepCycleDay } from "./pipeline-handlers.ts";
import type { Engine } from "@freeanima/runtime";

/** 注册内置 cron handler（睡眠周期 pipeline） */
export function registerBootCronHandlers(engine: Engine): void {
  registerSleepPipeline(engine);

  registerCronBuiltinHandler("builtin-sleep-cycle", async () => {
    const result = await runSleepCycle(resolveSleepCycleDay(), { trigger: "scheduled" });
    return JSON.stringify({
      ok: result.ok,
      day: result.day,
      status: result.status,
      steps: Object.fromEntries(
        Object.entries(result.steps).map(([id, s]) => [
          id,
          { status: s.status, error: s.error, skipped_reason: s.skipped_reason },
        ]),
      ),
    });
  });
}
