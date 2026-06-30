import { spawnSync } from "node:child_process";

/** cloudflared 默认 metrics 端口范围 */
export const TUNNEL_METRICS_PORTS = [20241, 20242, 20243, 20244, 20245] as const;

const HA_CONNECTIONS_RE = /^cloudflared_tunnel_ha_connections\s+(\d+(?:\.\d+)?)\s*$/m;

export type TunnelEdgeStatus = {
  /** 进程未运行时为 false；运行但无法探测时为 null */
  connected: boolean | null;
  haConnections: number | null;
};

/** 从 cloudflared /metrics 文本解析活跃边缘连接数 */
export function parseTunnelHaConnections(metricsBody: string): number | null {
  const match = metricsBody.match(HA_CONNECTIONS_RE);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function isTunnelEdgeConnected(haConnections: number | null): boolean {
  return haConnections != null && haConnections > 0;
}

/** 从 `ss -tlnp` 单行解析指定 PID 绑定的 metrics 端口 */
export function parseMetricsPortFromSsLine(line: string, pid: number): number | null {
  const pidMatch = line.match(/pid=(\d+)/);
  if (!pidMatch || Number(pidMatch[1]) !== pid) return null;
  const match = line.match(/127\.0\.0\.1:(\d+)/);
  if (!match?.[1]) return null;
  const port = Number(match[1]);
  return Number.isFinite(port) ? port : null;
}

/** 解析 `ss -tlnp` 输出，查找 cloudflared 进程的 metrics 端口 */
export function resolveMetricsPortForPid(pid: number, ssOutput: string): number | null {
  for (const line of ssOutput.split("\n")) {
    const port = parseMetricsPortFromSsLine(line, pid);
    if (port != null) return port;
  }
  return null;
}

function readSsListenOutput(): string {
  const r = spawnSync("ss", ["-tlnp"], { encoding: "utf-8" });
  return r.status === 0 ? String(r.stdout ?? "") : "";
}

function fetchMetricsBody(port: number): string | null {
  const r = spawnSync("curl", ["-s", "--max-time", "2", `http://127.0.0.1:${port}/metrics`], {
    encoding: "utf-8",
  });
  if (r.status !== 0) return null;
  const body = String(r.stdout ?? "").trim();
  return body.length > 0 ? body : null;
}

function probeMetricsPort(port: number): TunnelEdgeStatus | null {
  const body = fetchMetricsBody(port);
  if (body == null) return null;
  const haConnections = parseTunnelHaConnections(body);
  if (haConnections == null) return null;
  return {
    connected: isTunnelEdgeConnected(haConnections),
    haConnections,
  };
}

/**
 * 探测 cloudflared 是否已与 Cloudflare 边缘建立连接。
 * 优先读取进程 metrics；无 PID 时回退扫描默认端口。
 */
export function probeTunnelEdgeStatus(pid: number | null): TunnelEdgeStatus {
  const ports: number[] = [];
  if (pid != null && pid > 0) {
    const fromSs = resolveMetricsPortForPid(pid, readSsListenOutput());
    if (fromSs != null) ports.push(fromSs);
  }
  for (const port of TUNNEL_METRICS_PORTS) {
    if (!ports.includes(port)) ports.push(port);
  }

  for (const port of ports) {
    const status = probeMetricsPort(port);
    if (status != null) return status;
  }

  return { connected: null, haConnections: null };
}

/** CLI 展示用连接状态文案 */
export function formatTunnelConnectedLabel(status: TunnelEdgeStatus): string {
  if (status.connected === true) {
    const n = status.haConnections;
    return n != null ? `yes (${n} edge connections)` : "yes";
  }
  if (status.connected === false) {
    return "no — 未连上 Cloudflare 边缘（见 journalctl --user -u anima.service）";
  }
  return "unknown — 无法探测 metrics";
}
