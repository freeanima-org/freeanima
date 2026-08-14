import { registerCronBuiltinHandler } from "@freeanima/habitat/capabilities/connectors/cron";
import { registerSleepPipeline, runSleepCycle, resolveSleepCycleDay } from "./pipeline-handlers.ts";
import type { Engine } from "@freeanima/habitat/engine";

/** 注册内置 cron handler（睡眠周期 pipeline、邮箱同步） */
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

  registerCronBuiltinHandler("builtin-email-sync-all", async () => {
    const { runEmailSyncAllScheduled } = await import("./email-sync-handler.ts");
    return runEmailSyncAllScheduled();
  });

  registerCronBuiltinHandler("builtin-task-reminders", async () => {
    const { runTaskReminderScan } = await import("./task-reminder-handler.ts");
    return runTaskReminderScan();
  });

  registerCronBuiltinHandler("builtin-env-health", async () => {
    const { runEnvHealthScan } = await import("./env-health-handler.ts");
    return runEnvHealthScan();
  });

  registerCronBuiltinHandler("builtin-temporal-summary-tick", async () => {
    const { runTemporalSummaryTickHandler } = await import("./temporal-summary-handler.ts");
    return runTemporalSummaryTickHandler();
  });
}
