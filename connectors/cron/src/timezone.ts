const SIMPLE_HOUR_RE = /^(\S+)\s+(\d+|\*|\*\/\d+|\d+-\d+|\d+(?:,\d+)+)\s+(\S+)\s+(\S+)\s+(\S+)$/;

/** 5 段 cron 的 hour 字段是否为需 CST→UTC 转换的简单整数 */
function hasSimpleHourField(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const hour = parts[1]!;
  return /^\d+$/.test(hour);
}

/**
 * CST 语义 cron → UTC cron（Bun.cron 使用 UTC）。
 * 仅当 hour 为简单整数时转换；分钟级 step 等不变。
 */
export function cstCronToUtc(expr: string): string {
  const trimmed = expr.trim();
  if (!hasSimpleHourField(trimmed)) return trimmed;

  const parts = trimmed.split(/\s+/);
  const hour = parseInt(parts[1]!, 10);
  if (Number.isNaN(hour)) return trimmed;

  parts[1] = String((hour - 8 + 24) % 24);
  return parts.join(" ");
}

/** 测试用：判断表达式是否会被转换 */
export function isSimpleHourCron(expr: string): boolean {
  return SIMPLE_HOUR_RE.test(expr.trim()) && hasSimpleHourField(expr);
}
