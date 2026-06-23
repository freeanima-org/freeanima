/** Session ID `YYYYMMDD_HHMMSS_…` → 可读时间 */
export function formatSessionIdDateTime(sessionId: string): string {
  const parts = sessionId.split("_");
  if (parts.length < 2 || parts[0]!.length < 8 || parts[1]!.length < 4) {
    return sessionId;
  }
  const y = parts[0]!.slice(0, 4);
  const mo = parts[0]!.slice(4, 6);
  const d = parts[0]!.slice(6, 8);
  const h = parts[1]!.slice(0, 2);
  const mi = parts[1]!.slice(2, 4);
  return `${y}/${mo}/${d} ${h}:${mi}`;
}
