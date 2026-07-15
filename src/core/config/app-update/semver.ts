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
