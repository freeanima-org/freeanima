/** PG timestamptz write: unified ISO 8601 (Z) to avoid driver parse failures on +00:00 etc. */
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
