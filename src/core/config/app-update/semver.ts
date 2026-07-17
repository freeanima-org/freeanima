/** 规范化并比较 semver（忽略前导 v；仅主.次.修订数字段） */
export function normalizeSemver(raw: string): string {
  const s = raw.trim().replace(/^v/i, "");
  const m = s.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return "0.0.0";
  return `${m[1] ?? "0"}.${m[2] ?? "0"}.${m[3] ?? "0"}`;
}

export function compareSemver(a: string, b: string): number {
  const pa = normalizeSemver(a)
    .split(".")
    .map((x) => Number(x) || 0);
  const pb = normalizeSemver(b)
    .split(".")
    .map((x) => Number(x) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function isSemverNewer(remote: string, local: string): boolean {
  return compareSemver(remote, local) > 0;
}

/** 提取 `+YYYYMMDDHHmm` build stamp；无则 undefined */
export function extractBuildStamp(raw: string): string | undefined {
  const m = raw
    .trim()
    .replace(/^v/i, "")
    .match(/\+(\d{12})\b/);
  return m?.[1];
}

/**
 * 是否为可参与 canary 版本比较的具体版本串（非空、非浮动 tag `canary`，且以 X.Y 开头）。
 */
export function isConcreteCanaryVersion(raw: string): boolean {
  const s = raw.trim().replace(/^v/i, "");
  if (!s || s === "canary") return false;
  return /^\d+\.\d+/.test(s);
}

/**
 * 比较 canary 版本串：先主.次.修订，再比 `+YYYYMMDDHHmm`（字典序=时间序）；无 stamp 视为更旧。
 */
export function compareCanaryVersion(a: string, b: string): number {
  const sem = compareSemver(a, b);
  if (sem !== 0) return sem;
  const sa = extractBuildStamp(a);
  const sb = extractBuildStamp(b);
  if (sa && sb) {
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }
  if (sa && !sb) return 1;
  if (!sa && sb) return -1;
  return 0;
}

export function isCanaryVersionNewer(remote: string, local: string): boolean {
  return compareCanaryVersion(remote, local) > 0;
}
