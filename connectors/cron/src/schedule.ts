import { CronExpressionParser } from "cron-parser";

export enum ScheduleType {
  INTERVAL = "interval",
  CRON = "cron",
  ONESHOT = "oneshot",
}

const INTERVAL_RE = /^(?:every\s+)?(\d+)\s*(m|min|minute|minutes|h|hr|hour|hours)?$/i;

export function parseSchedule(expr: string): [ScheduleType, number | string] {
  const trimmed = expr.trim();

  const m = INTERVAL_RE.exec(trimmed);
  if (m) {
    const number = parseInt(m[1]!, 10);
    const unit = (m[2] ?? "m").toLowerCase()[0];
    const seconds = unit === "h" ? number * 3600 : number * 60;
    if (seconds < 60) {
      throw new Error(`Interval too short: ${expr} (minimum 1m)`);
    }
    return [ScheduleType.INTERVAL, seconds];
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 5) {
    try {
      CronExpressionParser.parse(trimmed);
      return [ScheduleType.CRON, trimmed];
    } catch (e) {
      throw new Error(`Invalid cron expression '${trimmed}': ${e}`, { cause: e });
    }
  }

  try {
    const ts = Date.parse(trimmed.replace("Z", "+00:00")) / 1000;
    if (Number.isNaN(ts)) throw new Error("invalid date");
    if (ts < Date.now() / 1000) {
      throw new Error(`One-shot time is in the past: ${trimmed}`);
    }
    return [ScheduleType.ONESHOT, ts];
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("One-shot")) throw e;
    throw new Error(
      `Unrecognised schedule expression: '${trimmed}'. Try '30m', 'every 2h', '0 9 * * *', or an ISO timestamp.`,
      { cause: e },
    );
  }
}
