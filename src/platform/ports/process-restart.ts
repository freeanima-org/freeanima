import { spawn } from "node:child_process";
import { logComponent } from "@freeanima/platform/logging";

/** systemctl unit name (without `.service` suffix) */
export const SYSTEMD_UNIT = "anima";

/** Whether managed by systemd user unit (INVOCATION_ID injected by systemd) */
export function isSystemdManaged(): boolean {
  return process.env.INVOCATION_ID != null;
}

/**
 * Trigger process restart.
 * - systemd managed: `systemctl --user restart` (unaffected by Restart= policy or exit code)
 * - other modes: SIGTERM graceful shutdown (process manager must restart)
 */
export async function triggerServiceRestart(): Promise<void> {
  if (isSystemdManaged()) {
    try {
      const child = spawn("systemctl", ["--user", "restart", SYSTEMD_UNIT], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return;
    } catch (e) {
      logComponent("server").error("systemctl restart failed", { err: e });
    }
  }

  try {
    process.kill(process.pid, "SIGTERM");
  } catch (e) {
    logComponent("server").error("failed to send SIGTERM", { err: e });
  }
}
