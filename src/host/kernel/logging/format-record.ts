import { normalizeAttributes } from "./serialize-error.ts";
import type { LogRecord } from "./types.ts";

/** CST (+08:00) offset — mirrors @freeanima/host/core/util CST_OFFSET_MS */
const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Epoch ms → human-readable CST timestamp for log lines */
export function formatLogTimestamp(epochMs: number, opts?: { seconds?: boolean }): string {
  const cst = new Date(epochMs + CST_OFFSET_MS);
  const y = cst.getUTCFullYear();
  const mo = pad2(cst.getUTCMonth() + 1);
  const d = pad2(cst.getUTCDate());
  const h = pad2(cst.getUTCHours());
  const mi = pad2(cst.getUTCMinutes());
  const s = pad2(cst.getUTCSeconds());
  const datePart = `${y}/${mo}/${d}`;
  if (opts?.seconds) return `${datePart} ${h}:${mi}:${s}`;
  return `${datePart} ${h}:${mi}`;
}

export function formatPrettyRecord(record: LogRecord): string {
  const ts = formatLogTimestamp(record.timestamp, { seconds: true });
  const component =
    typeof record.attributes.component === "string" ? `[${record.attributes.component}] ` : "";
  const { message, level, attributes } = record;
  const { component: _c, ...rest } = attributes;
  const restKeys = Object.keys(rest);
  const suffix = restKeys.length > 0 ? ` ${JSON.stringify(normalizeAttributes(rest))}` : "";
  return `${ts} ${level.toUpperCase()} ${component}${message}${suffix}`;
}

export function formatJsonRecord(record: LogRecord): string {
  return JSON.stringify({
    timestamp: record.timestamp,
    level: record.level,
    message: record.message,
    attributes: normalizeAttributes({ ...record.attributes }),
  });
}
