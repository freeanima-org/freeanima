import { hostname as osHostname, platform as osPlatform, release as osRelease } from "node:os";
import { readFileSync, statfsSync } from "node:fs";
import { getHomeDir } from "@freeanima/core/config/paths";
import { formatCstIsoFromEpoch } from "@freeanima/core/util";
import type { DependencyStatus } from "@freeanima/platform/ports/schemas/snapshot";
import type { FullRuntimeDeps } from "../runtime-deps.ts";
import { ANIMA_VERSION } from "../version.ts";
import { bandDiskFreeBytes, bandRssKb } from "./bands.ts";
import type { DepMarker, EnvHealthMarkers } from "./types.ts";

export type { DepMarker, EnvHealthMarkers } from "./types.ts";
export { bandRssKb, bandDiskFreeBytes } from "./bands.ts";
export { stableMarkersJson } from "./types.ts";

export type CollectMarkersOpts = {
  startTimeSec: number;
  deps: FullRuntimeDeps;
  /** 覆盖磁盘探测路径；默认 FREEANIMA_HOME */
  homeDir?: string;
  nowMs?: number;
};

export function depStatusToMarker(status: DependencyStatus): DepMarker {
  if (status.status === "connected") return "connected";
  if (status.status === "not_configured") return "not_configured";
  return "error";
}

export function readDiskFreeBytes(path: string): number | null {
  try {
    const st = statfsSync(path);
    return Number(st.bavail) * Number(st.bsize);
  } catch {
    return null;
  }
}

function readRssKb(): number {
  try {
    const text = readFileSync(`/proc/${process.pid}/status`, "utf-8");
    for (const line of text.split("\n")) {
      if (line.startsWith("VmRSS:")) {
        return parseInt(line.split(/\s+/)[1] ?? "0", 10);
      }
    }
  } catch {
    /* non-Linux */
  }
  return Math.round(process.memoryUsage().rss / 1024);
}

function timezoneLabel(nowMs: number): string {
  const offsetMin = -new Date(nowMs).getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `Asia/Shanghai (local UTC${sign}${hh}:${mm})`;
}

function mcpSummary(deps: FullRuntimeDeps): { connected: number; servers: number } {
  if (!deps.mcp) return { connected: 0, servers: 0 };
  const s = deps.mcp.getConnectionSummary();
  return { connected: s.connected_count, servers: s.server_count };
}

function acpSummary(deps: FullRuntimeDeps): { connected: number; agents: number } {
  const s = deps.acp.getStatus();
  return { connected: s.connected_count, agents: s.agent_count };
}

/** 从运行时采集并分档 */
export async function collectMarkers(opts: CollectMarkersOpts): Promise<EnvHealthMarkers> {
  const { buildDependenciesStatus } = await import("../service-status.ts");
  const nowMs = opts.nowMs ?? Date.now();
  const home = opts.homeDir ?? getHomeDir();
  const dependencies = await buildDependenciesStatus();
  const rssKb = readRssKb();
  const mcp = mcpSummary(opts.deps);
  const acp = acpSummary(opts.deps);
  const diskFree = readDiskFreeBytes(home);
  const boot =
    opts.startTimeSec > 0 ? formatCstIsoFromEpoch(opts.startTimeSec) : formatCstIsoFromEpoch(0);

  return {
    hostname: osHostname(),
    os: `${osPlatform()} ${osRelease()}`,
    timezone: timezoneLabel(nowMs),
    hub_version: ANIMA_VERSION,
    boot_started_at: boot,
    postgres: depStatusToMarker(dependencies.postgres),
    redis: depStatusToMarker(dependencies.redis),
    rss_band: bandRssKb(rssKb),
    mcp_connected: mcp.connected,
    mcp_servers: mcp.servers,
    acp_connected: acp.connected,
    acp_agents: acp.agents,
    disk_free_band: bandDiskFreeBytes(diskFree),
  };
}
