import { createLogger } from "@freeanima/kernel/logging";
import { createConsoleSink } from "@freeanima/kernel/logging/sinks/console.ts";
import { createKernel, ensureRootContext, type Kernel } from "@freeanima/kernel";
import { setHookLogger } from "@freeanima/habitat/core/hooks/cordis";
import type { Config } from "@freeanima/habitat/core/config";

/** Build Kernel for service (logger + shared process Cordis root context) */
export function createServiceKernel(_config: Config): Kernel {
  const logger = createLogger({ sinks: [createConsoleSink()] });
  const ctx = ensureRootContext();
  setHookLogger(ctx, logger);
  return createKernel({ logger, ctx });
}
