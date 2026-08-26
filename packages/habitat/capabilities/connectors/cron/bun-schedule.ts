import { parseBunCronUtc } from "./bun-cron-utc.ts";
import { ScheduleType, parseSchedule } from "./schedule.ts";
import { cstCronToUtc } from "./timezone.ts";

export type BunSchedule = { kind: "cron"; expr: string } | { kind: "oneshot"; atMs: number };

/** interval seconds → cron step expression (UTC, no timezone conversion) */
function intervalSecondsToCron(seconds: number): string {
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "0 * * * *" : `0 */${hours} * * *`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `*/${minutes} * * * *`;
}

/** Parse stored schedule into Bun scheduling form */
export function resolveBunSchedule(schedule: string): BunSchedule {
  const [schedType, value] = parseSchedule(schedule);

  if (schedType === ScheduleType.INTERVAL) {
    return { kind: "cron", expr: intervalSecondsToCron(value) };
  }

  if (schedType === ScheduleType.CRON) {
    return { kind: "cron", expr: cstCronToUtc(value) };
  }

  return { kind: "oneshot", atMs: value * 1000 };
}

/** Compute next run unix seconds; paused job returns 0 */
export function computeNextRunAt(schedule: string, paused = false): number | null {
  if (paused) return 0;

  const resolved = resolveBunSchedule(schedule);

  if (resolved.kind === "oneshot") {
    const nowSec = Date.now() / 1000;
    const ts = resolved.atMs / 1000;
    return ts > nowSec ? ts : null;
  }

  const next = parseBunCronUtc(resolved.expr);
  if (!next) return null;
  return Math.floor(next.getTime() / 1000);
}
