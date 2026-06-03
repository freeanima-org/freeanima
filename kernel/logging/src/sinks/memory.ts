import type { LogRecord, LogSink } from "../types.js";

export type MemorySink = LogSink & {
  readonly records: LogRecord[];
};

export function createMemorySink(): MemorySink {
  const records: LogRecord[] = [];
  return {
    records,
    emit(record: LogRecord): void {
      records.push(record);
    },
  };
}
