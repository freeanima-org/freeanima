import { normalizeAttributes } from "./serialize-error.js";
import type { LogRecord } from "./types.js";

export function formatPrettyRecord(record: LogRecord): string {
  const ts = new Date(record.timestamp).toISOString();
  const component =
    typeof record.attributes.component === "string"
      ? `[${record.attributes.component}] `
      : "";
  const { message, level, attributes } = record;
  const { component: _c, ...rest } = attributes;
  const restKeys = Object.keys(rest);
  const suffix =
    restKeys.length > 0
      ? ` ${JSON.stringify(normalizeAttributes(rest as Record<string, unknown>))}`
      : "";
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
