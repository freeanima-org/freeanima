import { spawnSync } from "node:child_process";
import { DEFAULT_BIND_HOST } from "@freeanima/platform/bind-hosts.ts";
import { REPO_ROOT } from "@freeanima/platform";

export const SERVICE_UNIT_NAME = "anima.service";

/** systemctl unit name (without `.service` suffix) */
export const SYSTEMD_UNIT = "anima";

/** Seconds to wait before restart after crash/abnormal exit */
export const SYSTEMD_RESTART_SEC = 180;

/** 0 = never give up restarting on consecutive failures (only `systemctl stop` can stop) */
export const SYSTEMD_START_LIMIT_INTERVAL_SEC = 0;

function systemctl(...args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("systemctl", ["--user", ...args], { encoding: "utf-8" });
}

/** Generate anima systemd user unit file content */
export function renderSystemdUnit(
  binPath: string,
  host = DEFAULT_BIND_HOST,
  port = 2658,
  workingDirectory = REPO_ROOT,
): string {
  const execStart = `${binPath} service start --foreground --host ${host} --port ${port}`;
  return `[Unit]
Description=FreeAnima stack（Habitat + optional Web）
After=network.target
# 0 = never give up restarting on consecutive failures (only systemctl stop can stop)
StartLimitIntervalSec=${SYSTEMD_START_LIMIT_INTERVAL_SEC}

[Service]
Type=simple
WorkingDirectory=${workingDirectory}
Environment=FREEANIMA_REPO_ROOT=${workingDirectory}
ExecStart=${execStart}
# Always restart except on systemctl stop; wait ${SYSTEMD_RESTART_SEC}s before restart
Restart=always
RestartSec=${SYSTEMD_RESTART_SEC}
TimeoutStopSec=120

[Install]
WantedBy=default.target
`;
}

/** Check if systemctl --user is available */
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

/**
 * 停止 Habitat stack（anima.service）。
 * Satellite 使用 PartOf=anima.service，随 hub 一并关停。
 */
export function stopHubStackViaSystemd(): ReturnType<typeof systemctl> | null {
  if (!systemdUserAvailable()) return null;
  return systemctl("stop", SYSTEMD_UNIT);
}
