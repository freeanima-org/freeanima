import { ScheduleType, parseSchedule } from "./schedule.ts";
import { cstCronToUtc } from "./timezone.ts";

export type BunSchedule = { kind: "cron"; expr: string } | { kind: "oneshot"; atMs: number };

/** interval 秒数 → cron step 表达式（UTC，无需时区转换） */
function intervalSecondsToCron(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "0 * * * *" : `0 */${hours} * * *`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `*/${minutes} * * * *`;
}

/** 将存储的 schedule 解析为 Bun 调度形式 */
export function resolveBunSchedule(schedule: string): BunSchedule {
  const [schedType, value] = parseSchedule(schedule);

  if (schedType === ScheduleType.INTERVAL) {
    return { kind: "cron", expr: intervalSecondsToCron(value as number) };
  }

  if (schedType === ScheduleType.CRON) {
    return { kind: "cron", expr: cstCronToUtc(value as string) };
  }

  return { kind: "oneshot", atMs: (value as number) * 1000 };
}

/** 计算下次运行 unix 秒；paused job 返回 0 */
export function computeNextRunAt(schedule: string, paused = false): number | null {
  if (paused) return 0;

  const resolved = resolveBunSchedule(schedule);

  if (resolved.kind === "oneshot") {
    const nowSec = Date.now() / 1000;
    const ts = resolved.atMs / 1000;
    return ts > nowSec ? ts : null;
  }

  const next = Bun.cron.parse(resolved.expr);
  if (!next) return null;
  return Math.floor(next.getTime() / 1000);
}
