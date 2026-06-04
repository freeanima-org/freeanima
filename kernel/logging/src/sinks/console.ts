import { formatJsonRecord, formatPrettyRecord } from "../format-record";
import type { LogRecord, LogSink } from "../types";

export type ConsoleSinkOptions = {
  format?: "pretty" | "json";
  write?: (line: string) => void;
};

export function createConsoleSink(options: ConsoleSinkOptions = {}): LogSink {
  const format = options.format ?? "pretty";
  const write = options.write ?? ((line: string) => console.error(line));

  return {
    emit(record: LogRecord): void {
      write(format === "json" ? formatJsonRecord(record) : formatPrettyRecord(record));
    },
  };
}
