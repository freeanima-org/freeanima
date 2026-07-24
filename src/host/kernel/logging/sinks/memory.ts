import type { LogRecord, LogSink } from "../types.ts";

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
