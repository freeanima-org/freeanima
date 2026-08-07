/** 构建戳版本串：`{base}-{local|canary}+{UTC YYYYMMDDHHmm}` */

export function formatUtcBuildStamp(d = new Date()): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}${mo}${day}${h}${mi}`;
}

function formatStampedVersion(
  nextVersion: string,
  prerelease: "local" | "canary",
  now = new Date(),
): string {
  const base = nextVersion.trim().replace(/^v/i, "");
  return `${base}-${prerelease}+${formatUtcBuildStamp(now)}`;
}

/** Canary：`{nextVersion}-canary+{UTC YYYYMMDDHHmm}` */
export function formatCanaryVersion(nextVersion: string, now = new Date()): string {
  return formatStampedVersion(nextVersion, "canary", now);
}

/** 本机 pack：`{base}-local+{UTC YYYYMMDDHHmm}` */
export function formatLocalVersion(nextVersion: string, now = new Date()): string {
  return formatStampedVersion(nextVersion, "local", now);
}
