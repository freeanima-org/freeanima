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

function emptyToNull<T>(value: T | null | undefined | ""): T | null {
  if (value === undefined || value === null || value === "") return null;
  return value;
}

export function pgTextOrNull(value: string | null | undefined): string | null {
  return emptyToNull(value);
}

export function pgJsonbOrNull<T>(value: T | null | undefined | ""): T | null {
  return emptyToNull(value);
}
