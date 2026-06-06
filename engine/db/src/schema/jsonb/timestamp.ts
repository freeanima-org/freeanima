/** PG timestamptz 写入：统一为 ISO 8601（Z），避免 +00:00 等格式在驱动层解析失败 */
export function normalizePgTimestamp(ts: string | Date | undefined | null): string {
  if (ts == null || ts === "") {
    return new Date().toISOString();
  }
  if (ts instanceof Date) {
    if (Number.isNaN(ts.getTime())) return new Date().toISOString();
    return ts.toISOString();
  }
  const parsed = new Date(ts);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}
