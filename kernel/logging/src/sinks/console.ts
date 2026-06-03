import { normalizeAttributes } from "../serialize-error.js";
import type { LogRecord, LogSink } from "../types.js";

export type ConsoleSinkOptions = {
  format?: "pretty" | "json";
  write?: (line: string) => void;
};

function formatPretty(record: LogRecord): string {
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

function formatJson(record: LogRecord): string {
  return JSON.stringify({
    timestamp: record.timestamp,
    level: record.level,
    message: record.message,
    attributes: normalizeAttributes({ ...record.attributes }),
  });
}

export function createConsoleSink(options: ConsoleSinkOptions = {}): LogSink {
  const format = options.format ?? "pretty";
  const write = options.write ?? ((line: string) => console.error(line));

  return {
    emit(record: LogRecord): void {
      write(format === "json" ? formatJson(record) : formatPretty(record));
    },
  };
}
