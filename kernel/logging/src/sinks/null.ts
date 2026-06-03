import type { LogSink } from "../types.js";

export function createNullSink(): LogSink {
  return {
    emit(): void {},
  };
}
