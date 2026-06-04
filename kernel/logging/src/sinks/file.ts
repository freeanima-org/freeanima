import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { formatJsonRecord, formatPrettyRecord } from "../format-record";
import type { LogRecord, LogSink } from "../types";

export type FileSinkOptions = {
  path: string;
  format?: "pretty" | "json";
  mkdir?: boolean;
  append?: (path: string, line: string) => void;
};

function defaultAppend(path: string, line: string, mkdir: boolean): void {
  if (mkdir) {
    mkdirSync(dirname(path), { recursive: true });
  }
  appendFileSync(path, `${line}\n`, "utf8");
}

export function createFileSink(options: FileSinkOptions): LogSink {
  const format = options.format ?? "json";
  const mkdir = options.mkdir ?? true;
  const append =
    options.append ?? ((path: string, line: string) => defaultAppend(path, line, mkdir));

  return {
    emit(record: LogRecord): void {
      const line = format === "json" ? formatJsonRecord(record) : formatPrettyRecord(record);
      append(options.path, line);
    },
  };
}
