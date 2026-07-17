/**
 * 从版本串解析 Android versionCode。
 * - release（纯 X.Y.Z）：major*10000 + minor*100 + patch
 * - canary/dev（含 prerelease / build meta）：在 base 上叠加 UTC 时间戳分钟，避免同 base 多次安装被拒
 * - 有 `+YYYYMMDDHHmm` 时优先用该 stamp 作为时钟源（与 versionName 对齐），否则回退墙钟
 */

/** 解析版本串中的 `+YYYYMMDDHHmm` 为 UTC Date；失败返回 undefined */
export function parseVersionBuildStampDate(version: string): Date | undefined {
  const m = version
    .trim()
    .replace(/^v/i, "")
    .match(/\+(\d{12})\b/);
  if (!m?.[1]) return undefined;
  const t = m[1];
  const y = Number(t.slice(0, 4));
  const mo = Number(t.slice(4, 6));
  const d = Number(t.slice(6, 8));
  const h = Number(t.slice(8, 10));
  const mi = Number(t.slice(10, 12));
  if (![y, mo, d, h, mi].every((n) => Number.isFinite(n))) return undefined;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export function computeAndroidVersionCode(
  version: string,
  opts?: { now?: Date; channel?: "release" | "canary" | "dev" },
): number {
  const s = version.trim().replace(/^v/i, "");
  const m = s.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  const major = Number.parseInt(m?.[1] ?? "0", 10) || 0;
  const minor = Number.parseInt(m?.[2] ?? "0", 10) || 0;
  const patch = Number.parseInt(m?.[3] ?? "0", 10) || 0;
  const base = major * 10_000 + minor * 100 + patch;

  const channel = opts?.channel;
  const needsStamp =
    channel === "canary" ||
    channel === "dev" ||
    /[-+]/.test(s); /* 有 prerelease/build meta 也按 stamp */

  if (!needsStamp) return base;

  const now = parseVersionBuildStampDate(s) ?? opts?.now ?? new Date();
  // 相对 2024-01-01 UTC 的分钟数，保证单调且落入 int 安全范围
  const epoch = Date.UTC(2024, 0, 1);
  const minutes = Math.floor((now.getTime() - epoch) / 60_000);
  const stamp = Math.max(0, minutes) % 1_000_000;
  return base * 1_000_000 + stamp;
}
