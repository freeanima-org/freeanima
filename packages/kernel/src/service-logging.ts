import {
  createLogger,
  type LogAttributes,
  type LogLevel,
  type Logger,
} from "@freeanima/kernel-logging";
import { createConsoleSink } from "@freeanima/kernel-logging/console";
import { createFileSink } from "@freeanima/kernel-logging/file";
import { PATHS } from "./paths.ts";

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

/** 创建服务默认 Logger：stderr pretty + ~/.anima/error.log JSONL */
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

/** 测试隔离：重置 lazy 单例 */
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

export type ErrorLogDetail = {
  error?: unknown;
  source?: string;
  context?: Record<string, unknown>;
};

function detailToAttributes(detail?: ErrorLogDetail): LogAttributes {
  const attributes: LogAttributes = { ...detail?.context };
  if (detail?.error !== undefined) {
    attributes.err = detail.error;
  }
  return attributes;
}

/** @deprecated 使用 logComponent(component).error() */
export function logError(message: string, detail?: ErrorLogDetail): void {
  const component = detail?.source ?? "app";
  logComponent(component).error(message, detailToAttributes(detail));
}

/** 启动阶段标记：未捕获错误记录后退出进程（供 systemd 感知失败） */
export function markStartupPhase(active: boolean): void {
  inStartupPhase = active;
}

/** 服务启动失败（CLI foreground / serve 初始化） */
export function logStartupError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  logComponent("startup").error(message, { err: error, ...context });
}

/** HTTP API 返回 { error } 时记录 */
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

/** SSE event:error 时记录 */
export function logSseError(path: string, error: unknown, context?: Record<string, unknown>): void {
  const msg = typeof error === "string" ? error : formatError(error);
  const attributes: LogAttributes = { path, ...context };
  if (typeof error !== "string") {
    attributes.err = error;
  }
  logComponent("sse").error(`SSE ${path}: ${msg}`, attributes);
}

/** 服务启动时安装全局未捕获错误处理 */
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
