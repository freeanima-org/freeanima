import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PATHS, CST_OFFSET_MS } from "./paths";

export type ErrorLogDetail = {
  error?: unknown;
  source?: string;
  context?: Record<string, unknown>;
};

let handlersInstalled = false;
let inStartupPhase = false;

/** 启动阶段标记：未捕获错误写入 error.log 后退出进程（供 systemd 感知失败） */
export function markStartupPhase(active: boolean): void {
  inStartupPhase = active;
}

/** 服务启动失败（CLI foreground / serve 初始化） */
export function logStartupError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  logError(message, { source: "startup", error, context });
}

function nowIso(): string {
  return new Date(Date.now() + CST_OFFSET_MS)
    .toISOString()
    .replace("Z", "+08:00");
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

function ensureLogDir(): void {
  mkdirSync(dirname(PATHS.errorLog), { recursive: true });
}

function formatLine(message: string, detail?: ErrorLogDetail): string {
  const parts = [`[${nowIso()}]`, detail?.source ? `[${detail.source}]` : "", message];
  let line = parts.filter(Boolean).join(" ");
  if (detail?.context && Object.keys(detail.context).length) {
    line += ` | ${JSON.stringify(detail.context)}`;
  }
  if (detail?.error !== undefined) {
    line += `\n${formatError(detail.error)}`;
  }
  return line;
}

/** 追加写入 ~/.anima/error.log，并镜像到 stderr */
export function logError(message: string, detail?: ErrorLogDetail): void {
  const line = formatLine(message, detail);
  try {
    ensureLogDir();
    appendFileSync(PATHS.errorLog, `${line}\n`, "utf-8");
  } catch {
    /* 日志写入失败时仍输出到控制台 */
  }
  console.error(line);
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
  logError(`API ${method} ${path} → ${status}: ${summary}`, {
    source: "api",
    context: { status, ...context },
    error: typeof error === "string" ? undefined : error,
  });
}

/** SSE event:error 时记录 */
export function logSseError(
  path: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const msg = typeof error === "string" ? error : formatError(error);
  logError(`SSE ${path}: ${msg}`, {
    source: "sse",
    context,
    error: typeof error === "string" ? undefined : error,
  });
}

/** 服务启动时安装全局未捕获错误处理 */
export function installErrorLogHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;

  process.on("uncaughtException", (err) => {
    logError("uncaughtException", { source: "process", error: err });
    if (inStartupPhase) process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logError("unhandledRejection", { source: "process", error: reason });
    if (inStartupPhase) process.exit(1);
  });
}
