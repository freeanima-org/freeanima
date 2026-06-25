import { PATHS, TUNNEL_PASS_PATHS, type TunnelConfig } from "@freeanima/core/config";
import { FileConfig } from "@freeanima/platform/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { cloudflaredBinPath, isCloudflaredInstalled } from "./tunnel-install.ts";
import { defaultCredentialsFile, writeTunnelIngressConfig } from "./tunnel-config-gen.ts";
import { resolveHubPort } from "./tunnel-hub-port.ts";
import { cloudflaredRunArgv } from "./tunnel-run.ts";
import {
  renderTunnelSystemdUnit,
  tunnelServiceUnitFileName,
  TUNNEL_SYSTEMD_UNIT,
} from "./tunnel-systemd-unit.ts";
import { cloudflaredRunExecStart } from "./tunnel-run.ts";
import { serviceUnitDir } from "./service-common.ts";
import { SYSTEMD_UNIT, systemdUserAvailable } from "./systemd-unit.ts";
import {
  formatTunnelConnectedLabel,
  probeTunnelEdgeStatus,
  type TunnelEdgeStatus,
} from "./tunnel-edge-status.ts";

const foregroundChild: { current: ChildProcess | null } = { current: null };

function systemctl(...args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("systemctl", ["--user", ...args], { encoding: "utf-8" });
}

function tunnelUnitPath(): string {
  return join(serviceUnitDir(), tunnelServiceUnitFileName());
}

export function isTunnelEnabled(): boolean {
  const cfg = FileConfig.open().data.tunnel;
  return cfg?.enabled === true;
}

/** 按当前 Hub 端口（status 文件 / 默认 2658）刷新 cloudflared ingress */
export function refreshTunnelIngressFromService(): boolean {
  const cfg = FileConfig.open().data.tunnel;
  if (!cfg?.hostname) return false;
  writeTunnelIngressConfig({
    hostname: cfg.hostname,
    hubPort: resolveHubPort(),
    credentialsFile: defaultCredentialsFile(),
    tunnelId: cfg.cloudflare?.tunnel_id,
  });
  return true;
}

export function ensureTunnelUnitFile(): boolean {
  if (!isCloudflaredInstalled()) return false;
  refreshTunnelIngressFromService();
  if (!existsSync(PATHS.cloudflaredConfigFile)) return false;
  const content = renderTunnelSystemdUnit(
    cloudflaredRunExecStart(cloudflaredBinPath(), {
      credentialsFile: defaultCredentialsFile(),
      configFile: PATHS.cloudflaredConfigFile,
      tunnelId: FileConfig.open().data.tunnel?.cloudflare?.tunnel_id,
    }),
  );
  const path = tunnelUnitPath();
  mkdirSync(serviceUnitDir(), { recursive: true });
  if (existsSync(path) && readFileSync(path, "utf-8") === content) {
    return false;
  }
  writeFileSync(path, content, "utf-8");
  return true;
}

export function startTunnelViaSystemd(): void {
  if (!systemdUserAvailable() || !isTunnelEnabled()) return;
  if (!ensureTunnelUnitFile()) {
    /* unit may already exist */
  }
  systemctl("daemon-reload");
  systemctl("enable", "--now", TUNNEL_SYSTEMD_UNIT);
}

export function stopTunnelViaSystemd(): void {
  if (!systemdUserAvailable()) return;
  if (!existsSync(tunnelUnitPath())) return;
  systemctl("stop", TUNNEL_SYSTEMD_UNIT);
}

/** systemd stop 目标：tunnel（若存在）与 hub 一次并行停止 */
export function hubStackSystemdUnits(): string[] {
  const units = [SYSTEMD_UNIT];
  if (existsSync(tunnelUnitPath())) {
    units.unshift(TUNNEL_SYSTEMD_UNIT);
  }
  return units;
}

/**
 * 一次 systemctl 并行停止 tunnel + hub。
 * Satellite 使用 PartOf=anima.service，随 hub 一并关停，无需单独 stop。
 */
export function stopHubStackViaSystemd(): ReturnType<typeof systemctl> | null {
  if (!systemdUserAvailable()) return null;
  return systemctl("stop", ...hubStackSystemdUnits());
}

export function startTunnelForeground(): ChildProcess | null {
  if (!isTunnelEnabled() || !isCloudflaredInstalled()) return null;
  refreshTunnelIngressFromService();
  if (!existsSync(PATHS.cloudflaredConfigFile)) return null;
  const cfg = FileConfig.open().data.tunnel;
  const argv = cloudflaredRunArgv(cloudflaredBinPath(), {
    credentialsFile: defaultCredentialsFile(),
    configFile: PATHS.cloudflaredConfigFile,
    tunnelId: cfg?.cloudflare?.tunnel_id,
  });
  const child = spawn(argv[0]!, argv.slice(1), { stdio: "inherit", detached: false });
  foregroundChild.current = child;
  child.on("exit", () => {
    if (foregroundChild.current === child) foregroundChild.current = null;
  });
  return child;
}

export function stopTunnelForeground(): void {
  const child = foregroundChild.current;
  if (child && !child.killed) {
    child.kill("SIGTERM");
  }
  foregroundChild.current = null;
}

export type TunnelStatus = {
  enabled: boolean;
  /** cloudflared 进程是否在运行（systemd / 前台） */
  running: boolean;
  /** 是否已与 Cloudflare 边缘建立连接；进程未运行时为 false */
  connected: boolean | null;
  haConnections: number | null;
  publicUrl: string | null;
  cloudflaredInstalled: boolean;
  configExists: boolean;
};

function tunnelProcessPid(): number | null {
  if (systemdUserAvailable() && existsSync(tunnelUnitPath())) {
    const r = systemctl("show", TUNNEL_SYSTEMD_UNIT, "-p", "MainPID", "--value");
    const pid = Number(String(r.stdout ?? "").trim());
    if (pid > 0) return pid;
  }
  const child = foregroundChild.current;
  if (child && !child.killed && child.pid != null && child.pid > 0) {
    return child.pid;
  }
  return null;
}

export function getTunnelEdgeStatus(running: boolean): TunnelEdgeStatus {
  if (!running) return { connected: false, haConnections: null };
  return probeTunnelEdgeStatus(tunnelProcessPid());
}

export { formatTunnelConnectedLabel };

export function getTunnelStatus(): TunnelStatus {
  const cfg = FileConfig.open().data.tunnel;
  const enabled = cfg?.enabled === true;
  let running = false;
  if (systemdUserAvailable() && existsSync(tunnelUnitPath())) {
    const r = systemctl("is-active", TUNNEL_SYSTEMD_UNIT);
    running = String(r.stdout ?? "").trim() === "active";
  } else if (foregroundChild.current && !foregroundChild.current.killed) {
    running = true;
  }
  const edge = getTunnelEdgeStatus(running);
  return {
    enabled,
    running,
    connected: edge.connected,
    haConnections: edge.haConnections,
    publicUrl: cfg?.hostname ? `https://${cfg.hostname}` : null,
    cloudflaredInstalled: isCloudflaredInstalled(),
    configExists: existsSync(PATHS.cloudflaredConfigFile),
  };
}

export function loadTunnelConfig(): TunnelConfig | undefined {
  return FileConfig.open().data.tunnel;
}

export { TUNNEL_PASS_PATHS };
