import { Context } from "cordis";
import { createLogger } from "./logging/index.ts";
import { createConsoleSink } from "./logging/sinks/console.ts";
import type { Logger } from "./logging/index.ts";
import { setRootLogger } from "./logging/root-logger.ts";

export type KernelDeps = {
  /** Cordis context that owns hook listeners; defaults to a bare context. */
  ctx?: Context;
  logger?: Logger;
};

function defaultLogger(): Logger {
  return createLogger({ sinks: [createConsoleSink()] });
}

/**
 * Construct Kernel; omitted deps use safe defaults (console logger / bare Cordis ctx).
 *
 * 组合根 context 由调用方持有（`server/bootstrap` 的 `serviceRootContext()`），
 * kernel 只做视图与 root logger 登记；不再安装进程级 context 句柄。
 */
export function createKernel(deps: KernelDeps = {}): Kernel {
  const logger = deps.logger ?? defaultLogger();
  const ctx = deps.ctx ?? new Context();
  setRootLogger(logger);
  return new Kernel(ctx, logger);
}

/** Kernel composition view (Cordis hook context / logger) */
export class Kernel {
  constructor(
    readonly ctx: Context,
    readonly logger: Logger,
  ) {}
}

export { getRootLogger, resetRootLoggerForTest, setRootLogger } from "./logging/root-logger.ts";

export type {
  Logger,
  LogLevel,
  LogAttributes,
  LogScope,
  LogRecord,
  LogSink,
  CreateLoggerOptions,
} from "./logging/index.ts";
