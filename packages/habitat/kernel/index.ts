import { Context } from "cordis";
import { createLogger } from "./logging/index.ts";
import { createConsoleSink } from "./logging/sinks/console.ts";
import type { Logger } from "./logging/index.ts";

export type KernelDeps = {
  /** Cordis context that owns hook listeners; defaults to a bare root context. */
  ctx?: Context;
  logger?: Logger;
};

function defaultLogger(): Logger {
  return createLogger({ sinks: [createConsoleSink()] });
}

/** Construct Kernel; omitted deps use safe defaults (console logger / bare Cordis ctx) */
export function createKernel(deps: KernelDeps = {}): Kernel {
  const logger = deps.logger ?? defaultLogger();
  const ctx = deps.ctx ?? new Context();
  return new Kernel(ctx, logger);
}

/** Kernel composition view (Cordis hook context / logger) */
export class Kernel {
  constructor(
    readonly ctx: Context,
    readonly logger: Logger,
  ) {}
}

export type {
  Logger,
  LogLevel,
  LogAttributes,
  LogScope,
  LogRecord,
  LogSink,
  CreateLoggerOptions,
} from "./logging/index.ts";
