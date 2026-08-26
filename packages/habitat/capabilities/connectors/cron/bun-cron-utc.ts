/**
 * Bun 1.4+ 进程内 `Bun.cron` / `parse` 默认按本地时区解释表达式。
 * 本仓库 schedule 语义：用户侧 CST 墙钟 → `cstCronToUtc` 得到 UTC 五段式，
 * 再交给 Bun 时必须固定 `tz: "UTC"`，否则在 Asia/Shanghai 等机会偏 8h。
 */
export const BUN_CRON_UTC: Bun.CronOptions = { tz: "UTC" };

/** 下一触发时刻（UTC 语义表达式） */
export function parseBunCronUtc(expr: string, from?: Date | number): Date | null {
  if (from === undefined) {
    return Bun.cron.parse(expr, Date.now(), BUN_CRON_UTC);
  }
  return Bun.cron.parse(expr, from, BUN_CRON_UTC);
}

/** 注册进程内 cron（UTC 语义表达式） */
export function scheduleBunCronUtc(
  expr: string,
  handler: (this: Bun.CronJob) => unknown,
): Bun.CronJob {
  return Bun.cron(expr, handler, BUN_CRON_UTC);
}
