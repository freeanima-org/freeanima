import {
  createLogger,
  type LogAttributes,
  type LogLevel,
  type Logger,
} from "@freeanima/kernel-logging";
import { createConsoleSink } from "@freeanima/kernel-logging/console";
import { createFileSink } from "@freeanima/kernel-logging/file";
import { PATHS } from "@freeanima/service-config";

let serviceLogger: Logger | null = null;
let handlersInstalled = false;
let inStartupPhase = false;

function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

/** Create default service Logger: stderr pretty + ~/.anima/error.log (one JSON per line) */
export function createServiceLogger(options?: { level?: LogLevel }): Logger {
  return createLogger({
    level: options?.level ?? resolveLogLevel(),
    sinks: [
      createConsoleSink({ format: "pretty" }),
      createFileSink({ path: PATHS.errorLog, format: "json" }),
    ],
  });
}

export function setServiceLogger(logger: Logger): void {
  serviceLogger = logger;
}

/** Test isolation: reset lazy singleton */
export function resetServiceLogger(): void {
  serviceLogger = null;
}

export function getServiceLogger(): Logger {
  if (!serviceLogger) {
    serviceLogger = createServiceLogger();
  }
  return serviceLogger;
}

export function logComponent(component: string): Logger {
  return getServiceLogger().with({ component });
}

export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? err.message;
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Startup phase marker: log uncaught errors then exit (for systemd failure detection) */
export function markStartupPhase(active: boolean): void {
  inStartupPhase = active;
}

/** Service startup failure (CLI foreground / serve init) */
export function logStartupError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  logComponent("startup").error(message, { err: error, ...context });
}

/** Log when HTTP API returns { error } */
export function logApiError(
  method: string,
  path: string,
  status: number,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const summary = typeof error === "string" ? error : formatError(error).split("\n")[0];
  const attributes: LogAttributes = { method, path, status, ...context };
  if (typeof error !== "string") {
    attributes.err = error;
  }
  logComponent("api").error(`API ${method} ${path} → ${status}: ${summary}`, attributes);
}

/** Log on SSE event:error */
export function logSseError(path: string, error: unknown, context?: Record<string, unknown>): void {
  const msg = typeof error === "string" ? error : formatError(error);
  const attributes: LogAttributes = { path, ...context };
  if (typeof error !== "string") {
    attributes.err = error;
  }
  logComponent("sse").error(`SSE ${path}: ${msg}`, attributes);
}

/** Install global uncaught error handlers at service startup */
export function installErrorLogHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;

  process.on("uncaughtException", (err) => {
    logComponent("process").error("uncaughtException", { err });
    if (inStartupPhase) process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logComponent("process").error("unhandledRejection", { err: reason });
    if (inStartupPhase) process.exit(1);
  });
}
