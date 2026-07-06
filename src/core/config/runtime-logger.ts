import { createLogger, type Logger } from "@freeanima/kernel/logging";
import { createNullSink } from "@freeanima/kernel/logging/null";

let runtimeLogger: Logger | null = null;

const fallbackLogger = createLogger({ level: "error", sinks: [createNullSink()] });

/** Composition root: register process logger (same instance as Engine.logger) */
export function registerRuntimeLogger(logger: Logger): void {
  runtimeLogger = logger;
}

export function getRuntimeLogger(): Logger {
  return runtimeLogger ?? fallbackLogger;
}

export function resetRuntimeLoggerForTest(): void {
  runtimeLogger = null;
}
