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
          logComponent("shutdown").warn(
            `Request drain timed out; ${n} in-flight request(s) remaining`,
            {
              max_ms: maxMs,
              in_flight: n,
            },
          );
        }
        resolve();
      }, maxMs);
    }),
  ]);
}

/**
 * For slash /restart: reject new requests → abort active engine → drain → trigger restart.
 * Fire-and-forget; does not block command response.
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
