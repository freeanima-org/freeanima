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
  const keys = Object.keys(current) as (keyof EnvHealthMarkers)[];
  const changedKeys: (keyof EnvHealthMarkers)[] = [];
  for (const k of keys) {
    if (current[k] !== baseline[k]) changedKeys.push(k);
  }
  return { changed: changedKeys.length > 0, changedKeys: changedKeys.toSorted() };
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
