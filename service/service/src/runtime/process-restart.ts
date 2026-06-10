import { triggerServiceRestart } from "@freeanima/service-api/process-restart";
import { logComponent } from "@freeanima/service-logging";
import type { EngineRunControl } from "./engine-run-control.ts";

export {
  isSystemdManaged,
  triggerServiceRestart,
  SYSTEMD_UNIT,
} from "@freeanima/service-api/process-restart";

const GRACEFUL_RESTART_DRAIN_MS = 30_000;

async function waitForDrainWithTimeout(runControl: EngineRunControl, maxMs: number): Promise<void> {
  await Promise.race([
    runControl.waitForDrain(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        const n = runControl.getInFlightCount();
        if (n > 0) {
          logComponent("shutdown").warn(`请求排空超时，仍有 ${n} 个进行中请求`, {
            max_ms: maxMs,
            in_flight: n,
          });
        }
        resolve();
      }, maxMs);
    }),
  ]);
}

/**
 * Slash /restart 专用：拒绝新请求 → abort 活跃 engine → drain → 触发重启。
 * fire-and-forget 调用，不阻塞命令响应。
 */
export function scheduleGracefulRestart(runControl: EngineRunControl): void {
  void (async () => {
    runControl.startShutdown();
    runControl.abortAll();
    await waitForDrainWithTimeout(runControl, GRACEFUL_RESTART_DRAIN_MS);
    if (runControl.getInFlightCount() > 0) {
      runControl.abortAll();
      await runControl.waitForDrain();
    }
    await triggerServiceRestart();
  })();
}
