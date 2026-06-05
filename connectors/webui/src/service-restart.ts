import { spawn } from "node:child_process";
import { logComponent } from "@freeanima/service-logging";

/** systemctl 单元名（不含 `.service` 后缀） */
export const SYSTEMD_UNIT = "anima";

/** 是否由 systemd user unit 托管（INVOCATION_ID 由 systemd 注入） */
export function isSystemdManaged(): boolean {
  return process.env.INVOCATION_ID != null;
}

/** 延迟后触发服务重启（HTTP 响应应先返回） */
export function scheduleServiceRestart(delayMs = 100): void {
  setTimeout(() => {
    void triggerServiceRestart();
  }, delayMs);
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
