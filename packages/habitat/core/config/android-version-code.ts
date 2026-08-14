/**
 * 从版本串 / channel 解析 Android versionCode（须落在 int32，且可覆盖安装）。
 *
 * 现行公式（generation floor 起）：
 * - 以 UTC 分钟为主序（优先版本串 `+YYYYMMDDHHmm`，否则 `opts.now` / 墙钟）
 * - 同一分钟内 release = canary/local + 1，便于从 canary 切到同次构建窗口的 release
 *
 * 旧公式 `base*1e6+(minutes%1e6)` 约在 2025-11 后 stamp 回绕，且 release 仅为
 * `base`，远小于 canary，会触发系统「已安装更新的版本」。floor 高于旧 0.x
 * canary 包，使新包可覆盖已装设备。
 */

const VERSION_CODE_EPOCH_MS = Date.UTC(2024, 0, 1);

/** 高于旧 canary（base×1e6+stamp，0.x 下约 < 1e9）的世代地板 */
export const ANDROID_VERSION_CODE_GENERATION_FLOOR = 1_200_000_000;

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

function parseSemverBase(version: string): number {
  const s = version.trim().replace(/^v/i, "");
  const m = s.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  const major = Number.parseInt(m?.[1] ?? "0", 10) || 0;
  const minor = Number.parseInt(m?.[2] ?? "0", 10) || 0;
  const patch = Number.parseInt(m?.[3] ?? "0", 10) || 0;
  return major * 10_000 + minor * 100 + patch;
}

export function computeAndroidVersionCode(
  version: string,
  opts?: { now?: Date; channel?: "release" | "canary" | "local" },
): number {
  const s = version.trim().replace(/^v/i, "");
  const channel = opts?.channel;
  const useClock =
    channel === "canary" ||
    channel === "local" ||
    channel === "release" ||
    /[-+]/.test(s); /* 有 prerelease/build meta 也按时钟 */

  if (!useClock) {
    // 无 channel 的纯 semver：保留可读 base（非 CI 同步路径）
    return parseSemverBase(s);
  }

  const now = parseVersionBuildStampDate(s) ?? opts?.now ?? new Date();
  const minutes = Math.max(0, Math.floor((now.getTime() - VERSION_CODE_EPOCH_MS) / 60_000));
  const releaseBit = channel === "release" ? 1 : 0;
  return ANDROID_VERSION_CODE_GENERATION_FLOOR + minutes * 2 + releaseBit;
}
