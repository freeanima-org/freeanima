import { createLogger, type LogLevel, type Logger } from "@freeanima/kernel/logging";
import { createConsoleSink } from "@freeanima/kernel/logging/sinks/console.ts";
import { createFileSink } from "@freeanima/kernel/logging/sinks/file.ts";
import { logComponent } from "@freeanima/kernel/logging/component.ts";
import { PATHS } from "@freeanima/core/config/paths";

let handlersInstalled = false;
let inStartupPhase = false;

function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

/**
 * Default service logger: stderr pretty + `~/.anima/error.log`.
 *
 * The composition root installs it as the kernel root logger
 * (`createServiceKernel` → `createKernel({ logger })`)，因此低层直接用
 * `@freeanima/kernel/logging/component.ts` 的 `logComponent` 即拿到同一实例。
 */
export function createServiceLogger(options?: { level?: LogLevel }): Logger {
  return createLogger({
    level: options?.level ?? resolveLogLevel(),
    sinks: [
      createConsoleSink({ format: "pretty" }),
      createFileSink({ path: PATHS.errorLog, format: "pretty" }),
    ],
  });
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
