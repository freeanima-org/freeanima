import { Context } from "cordis";

import type { Logger } from "../logging/index.ts";

/** 监听器失败时用于记录的最小 logger 视图。 */
export type HookLogger = Pick<Logger, "error">;

const loggers = new WeakMap<Context, HookLogger>();

/** Create the root Cordis context that owns all hook listeners. */
export function createHookContext(logger?: HookLogger): Context {
  const ctx = new Context();
  if (logger) loggers.set(ctx, logger);
  return ctx;
}

/** Attach the runtime logger used to contain listener failures. */
export function setHookLogger(ctx: Context, logger: HookLogger): void {
  loggers.set(ctx, logger);
}

/** The logger attached to a hook context, if any. */
export function getHookLogger(ctx: Context): HookLogger | undefined {
  return loggers.get(ctx);
}

/** Contain a listener failure (hook catalogs live in core; the plumbing is kernel). */
export function logHookError(ctx: Context, event: string, err: unknown): void {
  loggers.get(ctx)?.error("hook listener failed", { event, err });
}
