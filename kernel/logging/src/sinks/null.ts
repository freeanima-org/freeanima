import type { LogSink } from "../types";

export function createNullSink(): LogSink {
  return {
    emit(): void {},
  };
}
