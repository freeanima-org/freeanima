export type DepMarker = "connected" | "error" | "not_configured";

/** 分档后的环境+健康标记（对比用） */
export type EnvHealthMarkers = {
  hostname: string;
  os: string;
  timezone: string;
  hub_version: string;
  boot_started_at: string;
  postgres: DepMarker;
  redis: DepMarker;
  rss_band: string;
  mcp_connected: number;
  mcp_servers: number;
  acp_connected: number;
  acp_agents: number;
  disk_free_band: string;
};

/** 稳定序列化（键排序）供 fingerprint */
export function stableMarkersJson(markers: EnvHealthMarkers): string {
  const keys = Object.keys(markers).toSorted() as (keyof EnvHealthMarkers)[];
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = markers[k];
  return JSON.stringify(ordered);
}
