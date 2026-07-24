/** Canary 版本串：`{nextVersion}-canary+{UTC YYYYMMDDHHmm}` */

export function formatUtcBuildStamp(d = new Date()): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}${mo}${day}${h}${mi}`;
}

export function formatCanaryVersion(nextVersion: string, now = new Date()): string {
  const base = nextVersion.trim().replace(/^v/i, "");
  return `${base}-canary+${formatUtcBuildStamp(now)}`;
}
