import { spawnSync } from "node:child_process";
import { DEFAULT_BIND_HOST } from "@freeanima/legacy-server/bind-hosts";
import { REPO_ROOT } from "@freeanima/legacy-runtime";

export const SERVICE_UNIT_NAME = "anima.service";

/** systemctl 单元名（不含 `.service` 后缀） */
export const SYSTEMD_UNIT = "anima";

/** 崩溃/异常退出后等待多久再拉起（秒） */
export const SYSTEMD_RESTART_SEC = 180;

/** 0 = 不因连续失败而放弃重启（仅 `systemctl stop` 可停） */
export const SYSTEMD_START_LIMIT_INTERVAL_SEC = 0;

/** 生成 anima systemd user unit 文件内容 */
export function renderSystemdUnit(
  binPath: string,
  host = DEFAULT_BIND_HOST,
  port = 2658,
  workingDirectory = REPO_ROOT,
): string {
  const execStart = `${binPath} service start --foreground --host ${host} --port ${port}`;
  return `[Unit]
Description=逸灵风 Free Anima（单进程 HTTP 服务）
After=network.target

[Service]
Type=simple
WorkingDirectory=${workingDirectory}
Environment=FREEANIMA_REPO_ROOT=${workingDirectory}
ExecStart=${execStart}
# 除 systemctl stop 外始终重启；崩溃后等待 ${SYSTEMD_RESTART_SEC}s 再拉起
Restart=always
RestartSec=${SYSTEMD_RESTART_SEC}
StartLimitIntervalSec=${SYSTEMD_START_LIMIT_INTERVAL_SEC}
TimeoutStopSec=120

[Install]
WantedBy=default.target
`;
}

/** 检测 systemctl --user 是否可用 */
export function systemdUserAvailable(): boolean {
  try {
    const r = spawnSync("systemctl", ["--user", "status"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    return r.status === 0 || r.status === 3;
  } catch {
    return false;
  }
}
