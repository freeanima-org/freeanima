import { LoggerImpl } from "./logger-impl";
import type { CreateLoggerOptions, Logger } from "./types";

export function createLogger(options: CreateLoggerOptions): Logger {
  if (options.sinks.length === 0) {
    throw new Error("createLogger() 至少需要提供一个 sink");
  }
  return new LoggerImpl(options);
}
