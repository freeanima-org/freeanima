import { getNotificationPort } from "@freeanima/host/capabilities/tools/notification";
import { getAppRuntime, getRuntimeDeps } from "../service/runtime-context.ts";
import { runEnvHealthTick } from "../service/env-health/tick.ts";

/** 内置 cron：环境/健康基线扫描 */
export async function runEnvHealthScan(): Promise<string> {
  try {
    const runtime = getAppRuntime();
    const result = await runEnvHealthTick({
      startTimeSec: runtime.start_time,
      runtimeDeps: getRuntimeDeps(),
      notification: getNotificationPort(),
    });
    return JSON.stringify(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ ok: false, action: "skipped", error: message });
  }
}
