import { createLogger, type LogLevel, type Logger } from "@freeanima/habitat/kernel/logging";
import { createConsoleSink } from "@freeanima/habitat/kernel/logging/sinks/console.ts";
import { createFileSink } from "@freeanima/habitat/kernel/logging/sinks/file.ts";
import { PATHS } from "@freeanima/habitat/core/config/paths";

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

/** Create default service Logger: stderr pretty + ~/.anima/error.log (pretty text lines) */
export function createServiceLogger(options?: { level?: LogLevel }): Logger {
  return createLogger({
    level: options?.level ?? resolveLogLevel(),
    sinks: [
      createConsoleSink({ format: "pretty" }),
      createFileSink({ path: PATHS.errorLog, format: "pretty" }),
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
  // 启动失败先打可读正文（多行配置提示等），再写结构化日志
  const detail = error instanceof Error ? error.message : String(error);
  if (detail.length > 0 && detail !== message) {
    console.error(detail);
  }
  logComponent("startup").error(message, { err: error, ...context });
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
