import { spawn } from "node:child_process";
import { logComponent } from "@freeanima/service-logging";
import type { EngineRunControl } from "./engine-run-control.ts";

/** systemctl 单元名（不含 `.service` 后缀） */
export const SYSTEMD_UNIT = "anima";

/** 是否由 systemd user unit 托管（INVOCATION_ID 由 systemd 注入） */
export function isSystemdManaged(): boolean {
  return process.env.INVOCATION_ID != null;
}

/**
 * 触发进程重启。
 * - systemd 托管：`systemctl --user restart`（不受 Restart= 策略与 exit code 影响）
 * - 其他模式：SIGTERM 优雅关停（需进程管理器自行拉起）
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
