/** PG 时间戳规范化（schema 层自用） */
export function normalizePgTimestamp(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString();
}
