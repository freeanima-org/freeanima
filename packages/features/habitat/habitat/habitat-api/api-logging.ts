import type { Logger } from "@freeanima/kernel/logging";
import { formatError, type LogAttributes } from "@freeanima/kernel/logging";
import { createLogger } from "@freeanima/kernel/logging";
import { createNullSink } from "@freeanima/kernel/logging/sinks/null.ts";

let apiLogger: Logger | null = null;
let sseLogger: Logger | null = null;

/** 组合根在 Habitat 启动前绑定进程 Logger（与 createServiceLogger 同一实例） */
export function bindHabitatApiLogging(logger: Logger): void {
  apiLogger = logger.with({ component: "api" });
  sseLogger = logger.with({ component: "sse" });
}

export function resetConsoleApiLoggingForTest(): void {
  apiLogger = null;
  sseLogger = null;
}

function fallbackLogger(component: string): Logger {
  return createLogger({ level: "error", sinks: [createNullSink()] }).with({ component });
}

function requireApiLogger(): Logger {
  return apiLogger ?? fallbackLogger("api");
}

function requireSseLogger(): Logger {
  return sseLogger ?? fallbackLogger("sse");
}

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
  requireApiLogger().error(`API ${method} ${path} → ${status}: ${summary}`, attributes);
}

export function logSseError(path: string, error: unknown, context?: Record<string, unknown>): void {
  const msg = typeof error === "string" ? error : formatError(error);
  const attributes: LogAttributes = { path, ...context };
  if (typeof error !== "string") {
    attributes.err = error;
  }
  requireSseLogger().error(`SSE ${path}: ${msg}`, attributes);
}
