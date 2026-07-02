import { omitUndefined } from "@freeanima/core/util";
import { PATHS, TUNNEL_PASS_PATHS, type TunnelConfig } from "@freeanima/core/config";
import { FileConfig } from "@freeanima/platform/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { cloudflaredBinPath, isCloudflaredInstalled } from "./tunnel-install.ts";
import { defaultCredentialsFile, refreshTunnelIngressFromConfig } from "./tunnel-config-gen.ts";
import { cloudflaredRunArgv } from "./tunnel-run.ts";
import {
  renderTunnelSystemdUnit,
  tunnelServiceUnitFileName,
  TUNNEL_SYSTEMD_UNIT,
} from "./tunnel-systemd-unit.ts";
import { cloudflaredRunExecStart } from "./tunnel-run.ts";
import { serviceUnitDir } from "../service-common.ts";
import { SYSTEMD_UNIT, systemdUserAvailable } from "../systemd-unit.ts";
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

/** 按当前 Hub/Web 端口刷新 cloudflared ingress */
export function refreshTunnelIngressFromService(): boolean {
  return refreshTunnelIngressFromConfig();
}

/** @deprecated 保留兼容；stack 现通过 startTunnelForStack 托管 tunnel */
export function migrateLegacyTunnelUnit(): void {
  if (!systemdUserAvailable() || !isTunnelEnabled()) return;
  ensureTunnelUnitFile();
}

/** Stack 启动 tunnel：systemd 可用时用 anima-tunnel.service，否则前台 spawn */
export function startTunnelForStack(): ChildProcess | null {
  if (!isTunnelEnabled()) {
    console.warn("[stack] cloudflared 未启动：tunnel.enabled=false");
    return null;
  }
  if (systemdUserAvailable()) {
    startTunnelViaSystemd();
    if (isSystemdTunnelRunning() || findCloudflaredPidOnHost() != null) {
      console.log("[stack] cloudflared 已通过 systemd 启动 (anima-tunnel.service)");
    } else {
      console.warn(
        "[stack] cloudflared systemd 启动失败（见 journalctl --user -u anima-tunnel.service）",
      );
    }
    return null;
  }
  const existingPid = findCloudflaredPidOnHost();
  if (existingPid != null) {
    console.log(`[stack] cloudflared 已在运行 (PID ${existingPid})`);
    return null;
  }
  return startTunnelForeground();
}

export function stopTunnelForStack(): void {
  stopTunnelForeground();
  stopTunnelViaSystemd();
}

export function ensureTunnelUnitFile(): boolean {
  if (!isCloudflaredInstalled()) return false;
  refreshTunnelIngressFromService();
  if (!existsSync(PATHS.cloudflaredConfigFile)) return false;
  const content = renderTunnelSystemdUnit(
    cloudflaredRunExecStart(cloudflaredBinPath(), {
      credentialsFile: defaultCredentialsFile(),
      configFile: PATHS.cloudflaredConfigFile,
      ...omitUndefined({ tunnelId: FileConfig.open().data.tunnel?.cloudflare?.tunnel_id }),
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
  const unitChanged = ensureTunnelUnitFile();
  if (unitChanged) systemctl("daemon-reload");
  const active = systemctl("is-active", TUNNEL_SYSTEMD_UNIT);
  if (String(active.stdout ?? "").trim() === "active") return;
  const r = systemctl("enable", "--now", TUNNEL_SYSTEMD_UNIT);
  if (r.status !== 0) {
    console.warn(
      `[stack] cloudflared systemd 启动失败: ${String(r.stderr ?? r.stdout ?? "").trim()}`,
    );
  }
}

export function stopTunnelViaSystemd(): void {
  if (!systemdUserAvailable()) return;
  if (!existsSync(tunnelUnitPath())) return;
  systemctl("stop", TUNNEL_SYSTEMD_UNIT);
}

/** systemd stop 目标：单一 anima.service stack */
export function hubStackSystemdUnits(): string[] {
  return [SYSTEMD_UNIT];
}

/**
 * 一次 systemctl 并行停止 tunnel + hub。
 * Satellite 使用 PartOf=anima.service，随 hub 一并关停，无需单独 stop。
 */
export function stopHubStackViaSystemd(): ReturnType<typeof systemctl> | null {
  if (!systemdUserAvailable()) return null;
  stopTunnelViaSystemd();
  return systemctl("stop", ...hubStackSystemdUnits());
}

export function findCloudflaredPidOnHost(): number | null {
  const bin = cloudflaredBinPath();
  const r = spawnSync("pgrep", ["-f", `${bin} tunnel`], { encoding: "utf-8" });
  if (r.status !== 0) return null;
  for (const line of String(r.stdout ?? "")
    .trim()
    .split("\n")) {
    const pid = Number(line.trim());
    if (pid <= 0) continue;
    const cmd = spawnSync("ps", ["-p", String(pid), "-o", "args="], { encoding: "utf-8" });
    const args = String(cmd.stdout ?? "").trim();
    if (args.startsWith(bin)) return pid;
  }
  return null;
}

function isSystemdTunnelRunning(): boolean {
  if (!systemdUserAvailable()) return false;
  const r = systemctl("is-active", TUNNEL_SYSTEMD_UNIT);
  return String(r.stdout ?? "").trim() === "active";
}

function isForegroundTunnelChildAlive(): boolean {
  const child = foregroundChild.current;
  return child != null && !child.killed && child.pid != null && child.pid > 0;
}

export function startTunnelForeground(): ChildProcess | null {
  if (foregroundChild.current && !foregroundChild.current.killed) {
    return foregroundChild.current;
  }
  if (!isTunnelEnabled()) {
    console.warn("[stack] cloudflared 未启动：tunnel.enabled=false");
    return null;
  }
  if (!isCloudflaredInstalled()) {
    console.warn(`[stack] cloudflared 未启动：未安装 (${cloudflaredBinPath()})`);
    return null;
  }
  refreshTunnelIngressFromService();
  if (!existsSync(PATHS.cloudflaredConfigFile)) {
    console.warn(`[stack] cloudflared 未启动：缺少配置 ${PATHS.cloudflaredConfigFile}`);
    return null;
  }
  const existingPid = findCloudflaredPidOnHost();
  if (existingPid != null) {
    console.log(`[stack] cloudflared 已在运行 (PID ${existingPid})，跳过重复启动`);
    return null;
  }
  const cfg = FileConfig.open().data.tunnel;
  const argv = cloudflaredRunArgv(cloudflaredBinPath(), {
    credentialsFile: defaultCredentialsFile(),
    configFile: PATHS.cloudflaredConfigFile,
    ...omitUndefined({ tunnelId: cfg?.cloudflare?.tunnel_id }),
  });
  const bin = argv[0];
  if (bin === undefined) {
    throw new Error("cloudflared argv is empty");
  }
  const child = spawn(bin, argv.slice(1), {
    stdio: ["ignore", "inherit", "inherit"],
    detached: false,
  });
  foregroundChild.current = child;
  child.on("error", (err) => {
    console.error("[stack] cloudflared spawn 失败", err);
    if (foregroundChild.current === child) foregroundChild.current = null;
  });
  child.on("exit", (code, signal) => {
    if (foregroundChild.current === child) foregroundChild.current = null;
    if (code != null && code !== 0) {
      console.warn(`[stack] cloudflared 退出 code=${code} signal=${signal ?? ""}`);
    }
  });
  if (child.pid != null) {
    console.log(`[stack] cloudflared 已启动 (PID ${child.pid})`);
  }
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
  if (isForegroundTunnelChildAlive()) {
    const fg = foregroundChild.current;
    if (fg === null) return null;
    return fg.pid ?? null;
  }
  if (isSystemdTunnelRunning()) {
    const r = systemctl("show", TUNNEL_SYSTEMD_UNIT, "-p", "MainPID", "--value");
    const pid = Number(String(r.stdout ?? "").trim());
    if (pid > 0) return pid;
  }
  return findCloudflaredPidOnHost();
}

export function getTunnelEdgeStatus(running: boolean): TunnelEdgeStatus {
  if (!running) return { connected: false, haConnections: null };
  return probeTunnelEdgeStatus(tunnelProcessPid());
}

export { formatTunnelConnectedLabel };

export function getTunnelStatus(): TunnelStatus {
  const cfg = FileConfig.open().data.tunnel;
  const enabled = cfg?.enabled === true;
  const pid = tunnelProcessPid();
  const running = pid != null;
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
