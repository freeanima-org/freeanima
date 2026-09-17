import type { EnvHealthMarkers } from "./types.ts";

export type EnvHealthDiff = {
  changed: boolean;
  changedKeys: (keyof EnvHealthMarkers)[];
};

/** 对比当前标记与基线；无基线视为首次建档（changed=false） */
export function diffMarkers(
  current: EnvHealthMarkers,
  baseline: EnvHealthMarkers | null,
): EnvHealthDiff {
  if (baseline == null) {
    return { changed: false, changedKeys: [] };
  }
  const changedKeys: (keyof EnvHealthMarkers)[] = [];
  for (const key of Object.keys(current)) {
    if (!isEnvHealthMarkerKey(key)) continue;
    if (current[key] !== baseline[key]) changedKeys.push(key);
  }
  return { changed: changedKeys.length > 0, changedKeys: changedKeys.toSorted() };
}

function isEnvHealthMarkerKey(key: string): key is keyof EnvHealthMarkers {
  return (
    key === "hostname" ||
    key === "os" ||
    key === "timezone" ||
    key === "hub_version" ||
    key === "boot_started_at" ||
    key === "postgres" ||
    key === "redis" ||
    key === "rss_band" ||
    key === "mcp_connected" ||
    key === "mcp_servers" ||
    key === "acp_connected" ||
    key === "acp_agents" ||
    key === "disk_free_band"
  );
}

/** `env-health:<keys>:<fingerprint>`；keys 已排序 */
export function buildEnvHealthSourceRef(
  changedKeys: (keyof EnvHealthMarkers)[],
  fingerprint: string,
): string {
  const keys = [...changedKeys].toSorted().join(",");
  return `env-health:${keys}:${fingerprint}`;
}

/** 短指纹（稳定 JSON 的简易 hash） */
export function fingerprintMarkers(stableJson: string): string {
  let h = 2166136261;
  for (let i = 0; i < stableJson.length; i++) {
    h ^= stableJson.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
