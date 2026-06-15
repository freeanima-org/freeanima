const EMPTY = "—";

/** 简化 CST 展示（卫星 UI 不依赖 @freeanima/core） */
export function formatDisplayDateTime(value: unknown): string {
  if (value == null || value === "") return EMPTY;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

export function formatSessionIdDateTime(sessionId: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/.exec(sessionId);
  if (!match) return sessionId.slice(0, 16);
  const [, y, mo, d, h, mi] = match;
  return `${y}/${mo}/${d} ${h}:${mi}`;
}
