import type { LogSink } from "../types.ts";

export function createNullSink(): LogSink {
  return {
    emit(): void {},
  };
}
