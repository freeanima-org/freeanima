import { triggerServiceRestart } from "@freeanima/service-api/process-restart";
import { resolveAnimaExecutable } from "@freeanima/core/config/cli-install";
import { logComponent } from "@freeanima/service-logging";
import { spawnSync } from "node:child_process";
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
 * For slash /update: same drain, optional beforeRestart (e.g. anima update), then restart.
 * Fire-and-forget; does not block command response.
 */
export function scheduleGracefulRestart(
  runControl: EngineRunControl,
  opts?: { beforeRestart?: () => Promise<void> },
): void {
  void (async () => {
    runControl.startShutdown();
    runControl.abortAll();
    await waitForDrainWithTimeout(runControl, GRACEFUL_RESTART_DRAIN_MS);
    if (runControl.getInFlightCount() > 0) {
      runControl.abortAll();
      await runControl.waitForDrain();
    }
    try {
      await opts?.beforeRestart?.();
    } catch (err) {
      logComponent("shutdown").error("beforeRestart hook failed", { err });
    }
    await triggerServiceRestart();
  })();
}

/** Spawn `anima update` before service restart (slash /update). */
export async function runAnimaCliUpdate(): Promise<void> {
  const { command, args } = resolveAnimaExecutable(["update"]);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    logComponent("shutdown").error("anima update failed", {
      status: result.status,
      error: result.error?.message,
    });
  }
}
