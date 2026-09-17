/** RSS KB → `0-512MiB` / `512-1024MiB` / … */
export const RSS_BAND_MIB = 512;
const MIB = 1024;

export function bandRssKb(rssKb: number): string {
  const safe = Number.isFinite(rssKb) && rssKb > 0 ? rssKb : 0;
  const mib = safe / MIB;
  const lo = Math.floor(mib / RSS_BAND_MIB) * RSS_BAND_MIB;
  const hi = lo + RSS_BAND_MIB;
  return `${lo}-${hi}MiB`;
}

/**
 * 可用字节 → 磁盘档。
 * `<1GiB` | `1-2GiB` | `2-4GiB` | `4-8GiB` | `≥8GiB` | `unknown`
 */
export function bandDiskFreeBytes(freeBytes: number | null): string {
  if (freeBytes == null || !Number.isFinite(freeBytes) || freeBytes < 0) return "unknown";
  const gib = freeBytes / (1024 * 1024 * 1024);
  if (gib < 1) return "<1GiB";
  if (gib < 2) return "1-2GiB";
  if (gib < 4) return "2-4GiB";
  if (gib < 8) return "4-8GiB";
  return "≥8GiB";
}
