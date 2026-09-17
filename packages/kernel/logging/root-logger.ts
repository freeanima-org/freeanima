import { createLogger, type Logger } from "./index.ts";
import { createConsoleSink } from "./sinks/console.ts";

/**
 * Kernel-owned process logger handle.
 *
 * The server composition root installs the real logger (stderr + `~/.anima/error.log`)
 * via {@link setRootLogger}; tests and early startup fall back to a console logger.
 * Replaces the module-level `serviceLogger` singleton in `platform/logging`.
 */
let rootLogger: Logger | null = null;

function defaultConsoleLogger(): Logger {
  return createLogger({ sinks: [createConsoleSink()] });
}

/** Install the process logger (server boot / tests). */
export function setRootLogger(logger: Logger): void {
  rootLogger = logger;
}

/** The process logger; lazily falls back to a console logger. */
export function getRootLogger(): Logger {
  rootLogger ??= defaultConsoleLogger();
  return rootLogger;
}

/** Test isolation: drop the installed logger. */
export function resetRootLoggerForTest(): void {
  rootLogger = null;
}
