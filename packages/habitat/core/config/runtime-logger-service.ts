import { Service, type Context } from "cordis";
import { createLogger, type Logger } from "@freeanima/habitat/kernel/logging";
import { createNullSink } from "@freeanima/habitat/kernel/logging/sinks/null.ts";

declare module "cordis" {
  interface Context {
    runtimeLogger: RuntimeLoggerService;
  }
}

/** Used before the composition root registers the process logger. */
export const fallbackRuntimeLogger = createLogger({
  level: "error",
  sinks: [createNullSink()],
});

/**
 * Cordis service exposing the process logger as `ctx.runtimeLogger`.
 *
 * Replaces the former module-level runtime logger singleton; the engine
 * composition root registers the same instance it is constructed with.
 */
export class RuntimeLoggerService extends Service {
  private logger: Logger | null = null;

  constructor(ctx: Context) {
    super(ctx, "runtimeLogger");
  }

  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  getLogger(): Logger {
    return this.logger ?? fallbackRuntimeLogger;
  }

  reset(): void {
    this.logger = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountRuntimeLoggerService(ctx: Context): RuntimeLoggerService {
  const existing = ctx.runtimeLogger as RuntimeLoggerService | undefined;
  if (existing) return existing;
  return new RuntimeLoggerService(ctx);
}
